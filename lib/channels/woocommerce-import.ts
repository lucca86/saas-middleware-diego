/**
 * WooCommerce → Stockcurve importer v2
 *
 * Fixes vs v1:
 * - Correct status mapping: WC "publish"→"active", "trash"→"archived", resto→"draft"
 * - SKU deduplication: genera SKU único por variante cuando está vacío o es igual al padre
 * - Rollback manual por producto: si falla cualquier insert posterior al product, lo borra
 * - onProgress callback para streaming SSE
 * - Isolation: un producto fallido no detiene el resto
 */

import "server-only"
import { createServiceClient } from "@/lib/supabase/service"
import { slugify } from "@/lib/products/slug"
import {
  iterateProducts,
  fetchVariations,
  type WooCredentials,
  type WooProduct,
  type WooVariation,
} from "@/lib/channels/woocommerce"
import { writeSyncLogImport } from "@/lib/channels/sync-log"

// ─── Public types ─────────────────────────────────────────────────────────────

export interface ImportOptions {
  tenantId: string
  channelId: string
  creds: WooCredentials
  currency: string
  onProgress?: (event: ImportProgressEvent) => void
}

export interface ImportProgressEvent {
  phase: "fetching" | "importing" | "done"
  current: number
  total: number
  productName: string
  status: "ok" | "skip" | "error"
  error?: string
}

export interface ImportSummary {
  total: number
  imported: number
  skipped: number
  failed: number
  errors: string[]
}

// ─── Status mapping ───────────────────────────────────────────────────────────

/**
 * Maps WooCommerce product status → SC products.status (active|draft|archived).
 * WC values: publish | future | private | pending | draft | trash
 */
function mapProductStatus(wcStatus: string): "active" | "draft" | "archived" {
  switch (wcStatus) {
    case "publish":
    case "future":
      return "active"
    case "trash":
      return "archived"
    // private | pending | draft | any unknown → draft
    default:
      return "draft"
  }
}

/**
 * Maps variation status → SC product_variants.status (active | archived).
 * Note: "draft"/"disabled" are NOT valid for variants — only active/archived.
 */
function mapVariantStatus(v: {
  status?: string
  stock_status?: string
  stock_quantity?: number | null
  manage_stock?: boolean
}): "active" | "archived" {
  // Explicitly disabled/private/trash → archived
  if (v.status === "trash" || v.status === "private") return "archived"
  // Out of stock + managed stock → archived (variant exists but unavailable)
  if (v.manage_stock && v.stock_quantity != null && v.stock_quantity <= 0) return "archived"
  if (v.stock_status === "outofstock" && !v.manage_stock) return "archived"
  return "active"
}

// ─── SKU resolution ───────────────────────────────────────────────────────────

/**
 * Resolve a unique SKU for a variant. Priority:
 * 1. variation.sku if non-empty and not a duplicate of parent or already used
 * 2. {parent_sku}-{attr_values_slug}
 * 3. woo-{productId}-{variationId}
 */
function resolveVariantSku(opts: {
  rawSku: string | null | undefined
  parentSku: string | null
  productId: number
  variationId: number
  attributes: Array<{ name: string; option?: string }>
  usedSkus: Set<string>
}): string | null {
  const { rawSku, parentSku, productId, variationId, attributes, usedSkus } = opts

  if (rawSku && rawSku !== parentSku && !usedSkus.has(rawSku)) {
    usedSkus.add(rawSku)
    return rawSku
  }

  const attrSlug = attributes
    .map((a) => slugify(String(a.option ?? "")))
    .filter(Boolean)
    .join("-")

  if (attrSlug) {
    const candidate = parentSku ? `${parentSku}-${attrSlug}` : `woo-${productId}-${attrSlug}`
    if (!usedSkus.has(candidate)) {
      usedSkus.add(candidate)
      return candidate
    }
  }

  const fallback = `woo-${productId}-${variationId}`
  usedSkus.add(fallback)
  return fallback
}

// ─── Product type ─────────────────────────────────────────────────────────────

type AttrDef = {
  key: string
  label: string
  kind: "select" | "text" | "number"
  is_variant: boolean
  values?: string[]
}

async function ensureWooProductType(
  service: ReturnType<typeof createServiceClient>,
  tenantId: string,
  variantAttrNames: string[],
): Promise<string> {
  const { data: existing } = await service
    .from("product_types")
    .select("id, attributes")
    .eq("tenant_id", tenantId)
    .eq("name", "WooCommerce")
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
    await service
      .from("product_types")
      .update({ attributes: merged })
      .eq("id", existing.id)
    return existing.id as string
  }

  const { data: created, error } = await service
    .from("product_types")
    .insert({
      tenant_id: tenantId,
      name: "WooCommerce",
      slug: "woocommerce",
      attributes: merged,
    })
    .select("id")
    .single()
  if (error) throw new Error(`product_types: ${error.message}`)
  return created.id as string
}

// ─── Image download + R2 upload ───────────────────────────────────────────────

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"])
const MAX_BYTES = 8 * 1024 * 1024

async function downloadAndUpload(src: string, tenantId: string, productId: string): Promise<string> {
  // Lazy import so this file works without R2 env vars (falls back to src url)
  const r2AccountId = process.env.R2_ACCOUNT_ID
  const r2KeyId = process.env.R2_ACCESS_KEY_ID
  const r2Secret = process.env.R2_SECRET_ACCESS_KEY
  const r2Bucket = process.env.R2_BUCKET
  const r2Public = process.env.R2_PUBLIC_URL?.replace(/\/$/, "")

  if (!r2AccountId || !r2KeyId || !r2Secret || !r2Bucket || !r2Public) return src

  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3")
  const { randomUUID } = await import("node:crypto")

  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${r2AccountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: r2KeyId, secretAccessKey: r2Secret },
  })

  try {
    const res = await fetch(src, { cache: "no-store" })
    if (!res.ok) return src
    const mime = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase()
    if (!ALLOWED_MIME.has(mime)) return src
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.byteLength > MAX_BYTES) return src
    const ext = mime.includes("jpeg") ? "jpg" : mime.split("/")[1]
    const key = `tenants/${tenantId}/products/${productId}/${randomUUID()}.${ext}`
    await s3.send(
      new PutObjectCommand({
        Bucket: r2Bucket,
        Key: key,
        ContentType: mime,
        ContentLength: buf.byteLength,
        Body: buf,
      }),
    )
    return `${r2Public}/${key}`
  } catch {
    return src
  }
}

// ─── Per-product import (with manual rollback) ────────────────────────────────

async function importOneProduct(
  service: ReturnType<typeof createServiceClient>,
  opts: ImportOptions,
  typeId: string,
  wc: WooProduct,
): Promise<"imported" | "skipped"> {
  const { tenantId, channelId, creds, currency } = opts

  // Idempotency: skip if already mapped
  const { data: dup } = await service
    .from("channel_product_mappings")
    .select("product_id")
    .eq("channel_id", channelId)
    .eq("external_product_id", String(wc.id))
    .is("external_variant_id", null)
    .maybeSingle()
  if (dup?.product_id) return "skipped"

  // Fetch variations before any DB writes so a WC API failure doesn't leave partial data
  const variations: WooVariation[] =
    wc.type === "variable" ? await fetchVariations(creds, wc.id) : []

  // ── 1. Insert product ────────────────────────────────────────────────────
  const productSlug = `${slugify(wc.slug || wc.name)}-${wc.id}`

  const tagNames = (wc.tags ?? []).map((t) => t.name).filter(Boolean)

  const { data: product, error: productErr } = await service
    .from("products")
    .insert({
      tenant_id: tenantId,
      type_id: typeId,
      name: wc.name,
      slug: productSlug,
      description: wc.description || wc.short_description || null,
      status: mapProductStatus(wc.status),
      tags: tagNames.length > 0 ? tagNames : null,
      attributes: {
        woo_id: wc.id,
        channel_id: channelId,
        wc_currency: currency,
      },
    })
    .select("id")
    .single()
  if (productErr) throw new Error(productErr.message)
  const productId = product.id as string

  // Helper: delete product (cascades variants via FK) on any subsequent error
  const rollback = () => service.from("products").delete().eq("id", productId)

  // ── 2. Build + insert variants ───────────────────────────────────────────
  const usedSkus = new Set<string>()
  const parentSku = wc.sku || null

  type VariantRow = {
    tenant_id: string
    product_id: string
    sku: string | null
    price: number
    compare_at_price: number | null
    stock: number
    status: "active" | "archived"
    attributes: Record<string, string>
    position: number
  }

  let variantRows: VariantRow[]

  if (wc.type === "variable" && variations.length > 0) {
    variantRows = variations.map((v, idx) => {
      const attrMap: Record<string, string> = {}
      for (const a of v.attributes ?? []) attrMap[slugify(a.name)] = a.option ?? ""
      return {
        tenant_id: tenantId,
        product_id: productId,
        sku: resolveVariantSku({
          rawSku: v.sku,
          parentSku,
          productId: wc.id,
          variationId: v.id,
          attributes: v.attributes ?? [],
          usedSkus,
        }),
        price: parseFloat(v.regular_price || v.price || "0") || 0,
        compare_at_price:
          v.sale_price && v.regular_price && v.sale_price !== v.regular_price
            ? parseFloat(v.regular_price)
            : null,
        stock: v.manage_stock && v.stock_quantity != null ? v.stock_quantity : 0,
        status: mapVariantStatus(v),
        attributes: attrMap,
        position: idx,
      }
    })
  } else {
    const stock = wc.manage_stock && wc.stock_quantity != null ? wc.stock_quantity : 0
    variantRows = [
      {
        tenant_id: tenantId,
        product_id: productId,
        sku: resolveVariantSku({
          rawSku: wc.sku,
          parentSku,
          productId: wc.id,
          variationId: 0,
          attributes: [],
          usedSkus,
        }),
        price: parseFloat(wc.regular_price || wc.price || "0") || 0,
        compare_at_price:
          wc.sale_price && wc.regular_price && wc.sale_price !== wc.regular_price
            ? parseFloat(wc.regular_price)
            : null,
        stock,
        status: mapVariantStatus({ status: wc.status, stock_status: wc.stock_status, stock_quantity: stock, manage_stock: wc.manage_stock }),
        attributes: {},
        position: 0,
      },
    ]
  }

  const { data: createdVariants, error: varErr } = await service
    .from("product_variants")
    .insert(variantRows)
    .select("id, stock")

  if (varErr) {
    await rollback()
    throw new Error(`Variants: ${varErr.message}`)
  }

  // ── 3. Seed stock movements ──────────────────────────────────────────────
  const movements = (createdVariants ?? [])
    .filter((v) => (v.stock ?? 0) > 0)
    .map((v) => ({
      tenant_id: tenantId,
      product_id: productId,
      variant_id: v.id as string,
      type: "in" as const,
      qty: v.stock as number,
      reason: "Import inicial desde WooCommerce",
      reference: `wc:${wc.id}`,
    }))

  if (movements.length > 0) {
    const { error: movErr } = await service.from("stock_movements").insert(movements)
    if (movErr) {
      await rollback()
      throw new Error(`Stock movements: ${movErr.message}`)
    }
  }

  // ── 4. Channel mappings ──────────────────────────────────────────────────
  const mappingBase = {
    tenant_id: tenantId,
    channel_id: channelId,
    product_id: productId,
    external_product_id: String(wc.id),
    sync_direction: "imported" as const,
    last_synced_at: new Date().toISOString(),
  }

  const mappingRows = [
    { ...mappingBase, variant_id: null as string | null, external_variant_id: null as string | null },
    ...(createdVariants ?? []).map((cv, idx) => ({
      ...mappingBase,
      variant_id: cv.id as string,
      external_variant_id: wc.type === "variable" ? String(variations[idx]?.id ?? "") : null,
    })),
  ]

  const { error: mapErr } = await service
    .from("channel_product_mappings")
    .upsert(mappingRows, { onConflict: "channel_id,external_product_id,external_variant_id" })
  if (mapErr) {
    await rollback()
    throw new Error(`Mappings: ${mapErr.message}`)
  }

  // ── 5. Images → product_images table ────────────────────────────────────
  const wcImages = (wc.images ?? []).slice(0, 8)
  if (wcImages.length > 0) {
    const imageRows: Array<{
      product_id: string
      url: string
      position: number
      is_primary: boolean
      alt: string | null
    }> = []

    for (let idx = 0; idx < wcImages.length; idx++) {
      const img = wcImages[idx]
      try {
        const url = await downloadAndUpload(img.src, tenantId, productId)
        imageRows.push({
          product_id: productId,
          url,
          position: idx,
          is_primary: idx === 0,
          alt: img.alt || img.name || null,
        })
      } catch {
        imageRows.push({
          product_id: productId,
          url: img.src,
          position: idx,
          is_primary: idx === 0,
          alt: img.alt || img.name || null,
        })
      }
    }

    // Delete any existing images for idempotency then insert fresh
    await service.from("product_images").delete().eq("product_id", productId)
    await service.from("product_images").insert(imageRows)
  }

  return "imported"
}

// ─── Main entry ───────────────────────────────────────────────────────────────

export async function runWooImport(opts: ImportOptions): Promise<ImportSummary> {
  const { tenantId, channelId, creds, onProgress } = opts
  const service = createServiceClient()

  // Phase 1: fetch all products to know the total count + collect attr names
  onProgress?.({
    phase: "fetching",
    current: 0,
    total: 0,
    productName: "Descargando catálogo de WooCommerce…",
    status: "ok",
  })

  const allProducts: WooProduct[] = []
  for await (const p of iterateProducts(creds)) {
    allProducts.push(p)
  }

  const total = allProducts.length
  const summary: ImportSummary = { total, imported: 0, skipped: 0, failed: 0, errors: [] }

  // Collect all variant attribute names up front so the type is pre-populated
  const allAttrNames = new Set<string>()
  for (const p of allProducts) {
    for (const a of p.attributes ?? []) {
      if (a.variation) allAttrNames.add(a.name)
    }
  }

  const typeId = await ensureWooProductType(
    service,
    tenantId,
    Array.from(allAttrNames),
  )

  // Mark channel as syncing
  await service
    .from("sales_channels")
    .update({ status: "syncing", last_error: null })
    .eq("id", channelId)

  // Phase 2: import each product
  for (let i = 0; i < allProducts.length; i++) {
    const wc = allProducts[i]
    try {
      const result = await importOneProduct(service, opts, typeId, wc)
      if (result === "skipped") {
        summary.skipped++
        onProgress?.({ phase: "importing", current: i + 1, total, productName: wc.name, status: "skip" })
      } else {
        summary.imported++
        onProgress?.({ phase: "importing", current: i + 1, total, productName: wc.name, status: "ok" })
      }
    } catch (err) {
      summary.failed++
      const msg = `#${wc.id} ${wc.name}: ${err instanceof Error ? err.message : String(err)}`
      summary.errors.push(msg)
      onProgress?.({ phase: "importing", current: i + 1, total, productName: wc.name, status: "error", error: msg })
    }
  }

  // Phase 3: persist summary on channel
  const { data: ch } = await service.from("sales_channels").select("metadata").eq("id", channelId).single()
  await service
    .from("sales_channels")
    .update({
      status: summary.failed > 0 && summary.imported === 0 ? "error" : "connected",
      last_error: summary.errors.length > 0 ? summary.errors.slice(0, 3).join(" | ") : null,
      metadata: {
        ...((ch?.metadata as Record<string, unknown>) ?? {}),
        last_import_at: new Date().toISOString(),
        last_import_summary: summary,
      },
    })
    .eq("id", channelId)

  onProgress?.({
    phase: "done",
    current: total,
    total,
    productName: "Import completo",
    status: summary.failed > 0 && summary.imported === 0 ? "error" : "ok",
  })

  // Write a single sync log entry summarising the whole import run.
  void writeSyncLogImport({
    tenantId,
    channelId,
    status: summary.failed > 0 && summary.imported === 0
      ? "error"
      : summary.failed > 0
      ? "partial"
      : "ok",
    summary: `Import WooCommerce: ${summary.imported} importados, ${summary.skipped} omitidos, ${summary.failed} fallaron de ${summary.total}.`,
    payload: summary as unknown as Record<string, unknown>,
  })

  return summary
}
