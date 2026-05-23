/**
 * TiendaNube → Stockcurve importer
 *
 * Mirrors the WooCommerce importer in structure. Key differences:
 * - TN products have variants nested inline (no separate endpoint)
 * - Attribute names are localized: { es: "Talle", pt: "Tamanho" }
 * - Stock: variant.stock (deprecated) with fallback to inventory_levels[0].stock
 * - Status: product.published (bool) → "active" | "draft"
 * - SKU deduplication: same strategy as WC importer
 * - Full transactional rollback per product on failure
 */
import "server-only"
import { createServiceClient } from "@/lib/supabase/service"
import { slugify } from "@/lib/products/slug"
import {
  iterateTiendaNubeProducts,
  getTiendaNubeProductCount,
  pickLocalized,
  type TiendaNubeProduct,
  type TiendaNubeVariant,
} from "@/lib/channels/tiendanube"
import { writeSyncLogImport } from "@/lib/channels/sync-log"

// ─── Public types ─────────────────────────────────────────────────────────────

export interface TiendaNubeImportOptions {
  tenantId: string
  channelId: string
  storeId: string
  accessToken: string
  currency: string
  lang?: string
  onProgress?: (event: TiendaNubeImportProgressEvent) => void
}

export interface TiendaNubeImportProgressEvent {
  phase: "fetching" | "importing" | "done"
  current: number
  total: number
  productName: string
  status: "ok" | "skip" | "error"
  error?: string
}

export interface TiendaNubeImportSummary {
  total: number
  imported: number
  skipped: number
  failed: number
  errors: string[]
}

// ─── Status mapping ───────────────────────────────────────────────────────────

/** TN product published bool → SC status */
function mapProductStatus(published: boolean): "active" | "draft" {
  return published ? "active" : "draft"
}

/**
 * TN variant status → SC product_variants.status (active | archived).
 * TN doesn't have an explicit variant status field — we derive it from stock.
 */
function mapVariantStatus(v: TiendaNubeVariant): "active" | "archived" {
  if (!v.stock_management) return "active"
  const stock = resolveVariantStock(v)
  return stock <= 0 ? "archived" : "active"
}

// ─── Stock resolution ─────────────────────────────────────────────────────────

/**
 * TN deprecated `variant.stock` in favor of inventory_levels but many stores
 * still use the old field. We prefer inventory_levels when present.
 */
function resolveVariantStock(v: TiendaNubeVariant): number {
  if (v.inventory_levels && v.inventory_levels.length > 0) {
    return v.inventory_levels.reduce((sum, l) => sum + (l.stock ?? 0), 0)
  }
  return v.stock ?? 0
}

// ─── SKU resolution ───────────────────────────────────────────────────────────

/**
 * Resolve a unique SKU for a TN variant. Priority:
 * 1. variant.sku if non-empty and not equal to parent sku and not already used
 * 2. {parent_sku}-{attr_values_slug}
 * 3. tn-{productId}-{variantId}
 */
function resolveVariantSku(opts: {
  rawSku: string | null | undefined
  parentSku: string | null
  productId: number
  variantId: number
  values: Array<{ name: string }>
  usedSkus: Set<string>
  lang: string
}): string | null {
  const { rawSku, parentSku, productId, variantId, values, usedSkus, lang } = opts

  if (rawSku && rawSku !== parentSku && !usedSkus.has(rawSku)) {
    usedSkus.add(rawSku)
    return rawSku
  }

  const attrSlug = values
    .map((v) => slugify(v.name))
    .filter(Boolean)
    .join("-")

  if (attrSlug) {
    const candidate = parentSku ? `${parentSku}-${attrSlug}` : `tn-${productId}-${attrSlug}`
    if (!usedSkus.has(candidate)) {
      usedSkus.add(candidate)
      return candidate
    }
  }

  const fallback = `tn-${productId}-${variantId}`
  usedSkus.add(fallback)
  return fallback
}

// ─── Product type management ──────────────────────────────────────────────────

type AttrDef = {
  key: string
  label: string
  kind: "select" | "text" | "number"
  is_variant: boolean
  values?: string[]
}

async function ensureTiendaNubeProductType(
  service: ReturnType<typeof createServiceClient>,
  tenantId: string,
  variantAttrNames: string[],
): Promise<string> {
  const { data: existing } = await service
    .from("product_types")
    .select("id, attributes")
    .eq("tenant_id", tenantId)
    .eq("name", "Tienda Nube")
    .maybeSingle()

  const current: AttrDef[] = Array.isArray(existing?.attributes)
    ? (existing!.attributes as AttrDef[])
    : []
  const byKey = new Map(current.map((a) => [a.key, a]))

  for (const name of variantAttrNames) {
    const key = slugify(name)
    if (!byKey.has(key)) {
      byKey.set(key, { key, label: name, kind: "select", is_variant: true })
    }
  }

  const merged = Array.from(byKey.values())

  if (existing?.id) {
    await service.from("product_types").update({ attributes: merged }).eq("id", existing.id)
    return existing.id as string
  }

  const { data: created, error } = await service
    .from("product_types")
    .insert({ tenant_id: tenantId, name: "Tienda Nube", attributes: merged })
    .select("id")
    .single()
  if (error) throw new Error(`product_types: ${error.message}`)
  return created.id as string
}

// ─── Image download (reuse R2 pattern) ───────────────────────────────────────

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"])
const MAX_BYTES = 8 * 1024 * 1024

async function downloadAndUpload(src: string, tenantId: string, productId: string): Promise<string> {
  const r2AccountId = process.env.R2_ACCOUNT_ID
  const r2KeyId = process.env.R2_ACCESS_KEY_ID
  const r2Secret = process.env.R2_SECRET_ACCESS_KEY
  const r2Bucket = process.env.R2_BUCKET
  const r2Public = process.env.R2_PUBLIC_URL?.replace(/\/$/, "")

  if (!r2AccountId || !r2KeyId || !r2Secret || !r2Bucket || !r2Public) return src

  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3")
  const { randomUUID } = await import("node:crypto")

  const imgRes = await fetch(src, { cache: "no-store" })
  if (!imgRes.ok) return src

  const contentType = imgRes.headers.get("content-type")?.split(";")[0]?.trim() ?? "image/jpeg"
  if (!ALLOWED_MIME.has(contentType)) return src

  const buf = Buffer.from(await imgRes.arrayBuffer())
  if (buf.byteLength > MAX_BYTES) return src

  const ext = contentType.split("/")[1] ?? "jpg"
  const key = `tenants/${tenantId}/products/${productId}/${randomUUID()}.${ext}`

  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${r2AccountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: r2KeyId, secretAccessKey: r2Secret },
  })

  await s3.send(
    new PutObjectCommand({
      Bucket: r2Bucket,
      Key: key,
      Body: buf,
      ContentType: contentType,
    }),
  )

  return `${r2Public}/${key}`
}

// ─── Single product import ────────────────────────────────────────────────────

async function importOneTiendaNubeProduct(
  service: ReturnType<typeof createServiceClient>,
  tn: TiendaNubeProduct,
  opts: {
    tenantId: string
    channelId: string
    productTypeId: string
    currency: string
    lang: string
  },
): Promise<void> {
  const { tenantId, channelId, productTypeId, currency, lang } = opts

  // ── 1. Check if already imported (idempotency) ──────────────────────────────
  const { data: existing } = await service
    .from("channel_product_mappings")
    .select("product_id")
    .eq("channel_id", channelId)
    .eq("external_product_id", String(tn.id))
    .is("variant_id", null)
    .maybeSingle()

  if (existing) throw Object.assign(new Error("SKIP"), { isSkip: true })

  // ── 2. Resolve variant attribute names ──────────────────────────────────────
  // TN stores attribute names as localized objects on the product. Each variant
  // has a `values` array with IDs. We build the display name from product.attributes.
  const attrById = new Map<number, string>()
  for (const attr of tn.attributes ?? []) {
    const name = pickLocalized(attr.name, lang)
    for (const val of attr.values ?? []) {
      attrById.set(val.id, pickLocalized(val.name, lang))
    }
  }

  // Collect unique attribute names (only those that vary across variants)
  const variantAttrNames = new Set<string>()
  for (const attr of tn.attributes ?? []) {
    if (attr.values && attr.values.length > 1) {
      variantAttrNames.add(pickLocalized(attr.name, lang))
    }
  }

  // ── 3. Insert product ───────────────────────────────────────────────────────
  const name = pickLocalized(tn.name, lang) || `Producto ${tn.id}`
  const description = pickLocalized(tn.description ?? undefined, lang) || null
  const handle = pickLocalized(tn.handle ?? undefined, lang) || null
  const slug = handle ? slugify(handle) : slugify(name)

  const { data: product, error: productError } = await service
    .from("products")
    .insert({
      tenant_id: tenantId,
      product_type_id: productTypeId,
      name,
      slug,
      description,
      status: mapProductStatus(tn.published),
      attributes: {
        tn_id: tn.id,
        channel_id: channelId,
        tn_currency: currency,
        brand: tn.brand ?? null,
        tags: tn.tags ?? null,
      },
    })
    .select("id")
    .single()

  if (productError) throw new Error(`products insert: ${productError.message}`)
  const productId = product.id as string

  // ── 4. Upload images ────────────────────────────────────────────────────────
  const imageUrls: string[] = []
  for (const img of tn.images ?? []) {
    if (!img.src) continue
    try {
      const url = await downloadAndUpload(img.src, tenantId, productId)
      imageUrls.push(url)
    } catch {
      imageUrls.push(img.src)
    }
  }

  if (imageUrls.length > 0) {
    await service
      .from("products")
      .update({ images: imageUrls })
      .eq("id", productId)
  }

  // ── 5. Build + insert variants ──────────────────────────────────────────────
  const usedSkus = new Set<string>()

  // TN encodes variant attribute values as an array of value IDs that reference
  // the product.attributes. We build the display name from attrById.
  type VariantRow = {
    tenant_id: string
    product_id: string
    sku: string | null
    price: number
    compare_at_price: number | null
    stock: number
    status: "active" | "archived"
    attributes: Record<string, string>
  }

  const variantRows: VariantRow[] = (tn.variants ?? []).map((v) => {
    // Build attributes map: { "talle": "M", "color": "Rojo" }
    const attrValues: Record<string, string> = {}
    for (const valObj of v.values ?? []) {
      const valueName = attrById.get(valObj.id) ?? valObj.name
      // Find which attribute this value belongs to
      for (const attr of tn.attributes ?? []) {
        if (attr.values.some((av) => av.id === valObj.id)) {
          const attrKey = slugify(pickLocalized(attr.name, lang))
          attrValues[attrKey] = valueName
          break
        }
      }
    }

    const parentSku = tn.variants.length === 1 ? (tn.variants[0].sku ?? null) : null
    const sku = resolveVariantSku({
      rawSku: v.sku,
      parentSku,
      productId: tn.id,
      variantId: v.id,
      values: v.values.map((val) => ({ name: attrById.get(val.id) ?? val.name })),
      usedSkus,
      lang,
    })

    const price = parseFloat(v.price) || 0
    const compareAtPrice = v.compare_at_price ? parseFloat(v.compare_at_price) : null
    const stock = resolveVariantStock(v)

    return {
      tenant_id: tenantId,
      product_id: productId,
      sku,
      price,
      compare_at_price: compareAtPrice,
      stock,
      status: mapVariantStatus(v),
      attributes: attrValues,
    }
  })

  if (variantRows.length === 0) {
    // Products with no variants are invalid — rollback
    await service.from("products").delete().eq("id", productId)
    throw new Error("El producto no tiene variantes.")
  }

  const { data: insertedVariants, error: variantsError } = await service
    .from("product_variants")
    .insert(variantRows)
    .select("id, stock")

  if (variantsError) {
    await service.from("products").delete().eq("id", productId)
    throw new Error(`variants insert: ${variantsError.message}`)
  }

  // ── 6. Seed stock movements ─────────────────────────────────────────────────
  const movementRows = (insertedVariants ?? [])
    .map((row, idx) => ({
      tenant_id: tenantId,
      product_id: productId,
      variant_id: row.id,
      type: "in" as const,
      qty: row.stock as number,
      reason: "Import inicial desde Tienda Nube",
      reference: `tn:${tn.id}`,
    }))
    .filter((m) => m.qty > 0)

  if (movementRows.length > 0) {
    const { error: movErr } = await service.from("stock_movements").insert(movementRows)
    if (movErr) {
      await service.from("products").delete().eq("id", productId)
      throw new Error(`stock_movements: ${movErr.message}`)
    }
  }

  // ── 7. Persist channel_product_mappings ─────────────────────────────────────
  const variantTNIds = tn.variants.map((v) => v.id)
  const mappingRows = (insertedVariants ?? []).map((row, idx) => ({
    tenant_id: tenantId,
    channel_id: channelId,
    product_id: productId,
    variant_id: row.id as string,
    external_product_id: String(tn.id),
    external_variant_id: String(variantTNIds[idx] ?? ""),
    sync_direction: "imported" as const,
    last_synced_at: new Date().toISOString(),
  }))

  const productMapping = {
    tenant_id: tenantId,
    channel_id: channelId,
    product_id: productId,
    variant_id: null as string | null,
    external_product_id: String(tn.id),
    external_variant_id: null as string | null,
    sync_direction: "imported" as const,
    last_synced_at: new Date().toISOString(),
  }

  const { error: mappingErr } = await service
    .from("channel_product_mappings")
    .upsert([productMapping, ...mappingRows], {
      onConflict: "channel_id,external_product_id,external_variant_id",
    })

  if (mappingErr) {
    await service.from("products").delete().eq("id", productId)
    throw new Error(`channel_product_mappings: ${mappingErr.message}`)
  }
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function runTiendaNubeImport(opts: TiendaNubeImportOptions): Promise<TiendaNubeImportSummary> {
  const { tenantId, channelId, storeId, accessToken, currency, lang = "es", onProgress } = opts
  const service = createServiceClient()

  const summary: TiendaNubeImportSummary = {
    total: 0,
    imported: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  }

  // ── Phase 1: Count products for progress bar ─────────────────────────────────
  onProgress?.({ phase: "fetching", current: 0, total: 0, productName: "Contando productos…", status: "ok" })
  const total = await getTiendaNubeProductCount(storeId, accessToken)
  summary.total = total

  // ── Phase 2: Fetch all products ──────────────────────────────────────────────
  onProgress?.({ phase: "fetching", current: 0, total, productName: "Descargando catálogo…", status: "ok" })
  const allProducts: TiendaNubeProduct[] = []
  for await (const p of iterateTiendaNubeProducts(storeId, accessToken)) {
    allProducts.push(p)
  }
  summary.total = allProducts.length

  // ── Phase 3: Discover all unique variant attribute names ─────────────────────
  const allAttrNames = new Set<string>()
  for (const p of allProducts) {
    for (const attr of p.attributes ?? []) {
      if (attr.values && attr.values.length > 0) {
        allAttrNames.add(pickLocalized(attr.name, lang))
      }
    }
  }

  const productTypeId = await ensureTiendaNubeProductType(service, tenantId, Array.from(allAttrNames))

  // ── Phase 4: Import each product ─────────────────────────────────────────────
  let current = 0
  for (const tn of allProducts) {
    current++
    const productName = pickLocalized(tn.name, lang) || `#${tn.id}`

    onProgress?.({ phase: "importing", current, total: summary.total, productName, status: "ok" })

    try {
      await importOneTiendaNubeProduct(service, tn, {
        tenantId,
        channelId,
        productTypeId,
        currency,
        lang,
      })
      summary.imported++
    } catch (err) {
      const isSkip = err instanceof Error && (err as Error & { isSkip?: boolean }).isSkip
      if (isSkip) {
        summary.skipped++
        onProgress?.({ phase: "importing", current, total: summary.total, productName, status: "skip" })
      } else {
        summary.failed++
        const message = `${productName}: ${err instanceof Error ? err.message : String(err)}`
        summary.errors.push(message)
        onProgress?.({ phase: "importing", current, total: summary.total, productName, status: "error", error: message })
      }
    }
  }

  // ── Phase 5: Mark channel as imported ────────────────────────────────────────
  await service
    .from("sales_channels")
    .update({
      metadata: {
        last_import: new Date().toISOString(),
        last_import_summary: summary,
      },
      last_synced_at: new Date().toISOString(),
    })
    .eq("id", channelId)

  onProgress?.({
    phase: "done",
    current: summary.total,
    total: summary.total,
    productName: "Import completo",
    status: summary.failed > 0 && summary.imported === 0 ? "error" : "ok",
  })

  // Write sync log
  void writeSyncLogImport({
    tenantId,
    channelId,
    status:
      summary.failed > 0 && summary.imported === 0
        ? "error"
        : summary.failed > 0
          ? "partial"
          : "ok",
    summary: `Import Tienda Nube: ${summary.imported} importados, ${summary.skipped} omitidos, ${summary.failed} fallaron de ${summary.total}.`,
    payload: summary as unknown as Record<string, unknown>,
  })

  return summary
}
