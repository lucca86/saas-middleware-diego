import "server-only"
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { randomUUID } from "node:crypto"
import { createServiceClient } from "@/lib/supabase/service"
import { slugify } from "@/lib/products/slug"
import {
  fetchVariations,
  iterateProducts,
  type WooAttribute,
  type WooCredentials,
  type WooProduct,
  type WooVariation,
} from "@/lib/channels/woocommerce"

/**
 * WooCommerce → Stockcurve one-shot importer.
 *
 * Strategy chosen with the user:
 *  - All imported products go under a single "WooCommerce" product type per tenant.
 *  - Variant attributes accumulate on that type as they appear (Color, Talle, Material…).
 *  - Images are downloaded and re-uploaded to R2 so the storefront stays
 *    independent of the WP install.
 *  - This is the only path that pulls data from WC. After this runs once,
 *    Stockcurve becomes the source of truth — Sprint B handles SC → WC sync.
 *
 * The function is **idempotent at the variant level**: re-running it for a
 * channel with the same WC product ids will UPSERT instead of duplicating,
 * but local edits are preserved (we only INSERT new products; existing ones
 * are skipped). That's why the UI guards re-imports behind a confirmation.
 */

export interface ImportProgress {
  total: number
  imported: number
  skipped: number
  failed: number
  errors: string[]
}

export interface ImportSummary extends ImportProgress {
  channelId: string
  startedAt: string
  finishedAt: string
}

interface Ctx {
  tenantId: string
  channelId: string
  productTypeId: string
  service: ReturnType<typeof createServiceClient>
  r2: { bucket: string; client: S3Client; publicBase: string } | null
  creds: WooCredentials
  currency: string
}

/** Resolves (or creates) the canonical "WooCommerce" product type for the tenant. */
async function ensureWooProductType(
  service: ReturnType<typeof createServiceClient>,
  tenantId: string,
): Promise<string> {
  const slug = "woocommerce"
  const existing = await service
    .from("product_types")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("slug", slug)
    .maybeSingle()
  if (existing.data?.id) return existing.data.id as string

  const inserted = await service
    .from("product_types")
    .insert({
      tenant_id: tenantId,
      name: "WooCommerce",
      slug,
      icon: "store",
      attributes: [],
      is_system: false,
    })
    .select("id")
    .single()
  if (inserted.error) throw new Error(`No se pudo crear el tipo WooCommerce: ${inserted.error.message}`)
  return inserted.data.id as string
}

/**
 * Merge variant-relevant WC attributes into the product type's `attributes`
 * JSON. Each WC attribute becomes one entry with `is_variant: true` so the
 * VariantsMatrix later treats them as variant axes.
 */
async function mergeVariantAttributesIntoType(
  service: ReturnType<typeof createServiceClient>,
  productTypeId: string,
  product: WooProduct,
) {
  // We only care about attributes that drive variations in WC. Non-variation
  // attributes are descriptive metadata and live in product.attributes JSON.
  const variantAttrs = product.attributes.filter((a) => a.variation && a.options.length > 0)
  if (variantAttrs.length === 0) return

  const { data: typeRow } = await service
    .from("product_types")
    .select("attributes")
    .eq("id", productTypeId)
    .single()

  type AttrDef = {
    name: string
    key: string
    kind: "select" | "text" | "number"
    is_variant: boolean
    values?: string[]
  }
  const current: AttrDef[] = Array.isArray(typeRow?.attributes) ? (typeRow!.attributes as AttrDef[]) : []
  const byKey = new Map(current.map((a) => [a.key, a]))

  for (const attr of variantAttrs) {
    const key = slugify(attr.name)
    const prev = byKey.get(key)
    const mergedValues = Array.from(
      new Set([...(prev?.values ?? []), ...attr.options.map((o) => o.trim()).filter(Boolean)]),
    )
    byKey.set(key, {
      name: attr.name,
      key,
      kind: "select",
      is_variant: true,
      values: mergedValues,
    })
  }

  await service
    .from("product_types")
    .update({ attributes: Array.from(byKey.values()) })
    .eq("id", productTypeId)
}

/** Collapse a WooProduct's variant attribute *names* selected for this product. */
function selectedVariantAttrKeys(product: WooProduct): string[] {
  return product.attributes
    .filter((a) => a.variation && a.options.length > 0)
    .map((a) => slugify(a.name))
}

/** Map a WC variation's attributes array to our `{key: value}` shape. */
function variationAttributesToObject(
  variation: WooVariation,
  product: WooProduct,
): Record<string, string> {
  const result: Record<string, string> = {}
  for (const va of variation.attributes) {
    // Match against the parent product's attribute names so the keys align
    // with what we wrote into the type definition.
    const parent = product.attributes.find(
      (a) => a.id === va.id || a.name.toLowerCase() === va.name.toLowerCase(),
    )
    const key = slugify(parent?.name ?? va.name)
    if (key) result[key] = va.option
  }
  return result
}

/** Resolves the R2 client lazily; returns null if R2 isn't configured. */
function getR2(): Ctx["r2"] {
  const accountId = process.env.R2_ACCOUNT_ID
  const keyId = process.env.R2_ACCESS_KEY_ID
  const secret = process.env.R2_SECRET_ACCESS_KEY
  const bucket = process.env.R2_BUCKET
  const publicBase = process.env.R2_PUBLIC_URL?.replace(/\/$/, "")
  if (!accountId || !keyId || !secret || !bucket || !publicBase) return null
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: keyId, secretAccessKey: secret },
  })
  return { bucket, client, publicBase }
}

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
])
const MAX_IMAGE_BYTES = 10 * 1024 * 1024

async function downloadAndUploadImage(
  ctx: Ctx,
  productId: string,
  src: string,
): Promise<{ storageKey: string; publicUrl: string; mime: string; size: number } | null> {
  if (!ctx.r2) return null
  try {
    const res = await fetch(src, { cache: "no-store" })
    if (!res.ok) return null
    const mime = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase()
    if (!ALLOWED_MIME.has(mime)) return null
    const length = Number.parseInt(res.headers.get("content-length") ?? "0", 10)
    if (length > MAX_IMAGE_BYTES) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.byteLength > MAX_IMAGE_BYTES) return null

    const ext = mime.split("/")[1] === "jpeg" ? "jpg" : mime.split("/")[1]
    const id = randomUUID()
    const storageKey = `tenants/${ctx.tenantId}/products/${productId}/${id}.${ext}`

    await ctx.r2.client.send(
      new PutObjectCommand({
        Bucket: ctx.r2.bucket,
        Key: storageKey,
        ContentType: mime,
        ContentLength: buf.byteLength,
        Body: buf,
      }),
    )
    return {
      storageKey,
      publicUrl: `${ctx.r2.publicBase}/${storageKey}`,
      mime,
      size: buf.byteLength,
    }
  } catch {
    return null
  }
}

/** Insert a product+variants+stock for a single WC product. Returns true if created. */
async function importOneProduct(ctx: Ctx, wc: WooProduct): Promise<boolean> {
  const { service, tenantId, productTypeId, channelId } = ctx

  // Skip if we already imported this WC product for this channel.
  const dup = await service
    .from("products")
    .select("id")
    .eq("tenant_id", tenantId)
    .contains("attributes", { woo_id: wc.id, channel_id: channelId })
    .maybeSingle()
  if (dup.data?.id) return false

  // Update the type definition with any new variant attribute options.
  await mergeVariantAttributesIntoType(service, productTypeId, wc)

  // Resolve / create category from the first WC category if any.
  let categoryId: string | null = null
  const firstCat = wc.categories[0]
  if (firstCat) {
    const catSlug = slugify(firstCat.slug || firstCat.name)
    const existing = await service
      .from("categories")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("slug", catSlug)
      .maybeSingle()
    if (existing.data?.id) {
      categoryId = existing.data.id as string
    } else {
      const created = await service
        .from("categories")
        .insert({ tenant_id: tenantId, name: firstCat.name, slug: catSlug })
        .select("id")
        .single()
      if (!created.error) categoryId = created.data.id as string
    }
  }

  // Insert the product. We tag attributes with provenance so re-imports can
  // detect duplicates and Sprint B (SC → WC push) can find the WC ids.
  const productSlug = `${slugify(wc.slug || wc.name)}-${wc.id}`
  const productInsert = await service
    .from("products")
    .insert({
      tenant_id: tenantId,
      type_id: productTypeId,
      category_id: categoryId,
      sku: wc.sku || null,
      name: wc.name,
      slug: productSlug,
      description: wc.description || wc.short_description || null,
      status: wc.status === "publish" ? "active" : "draft",
      tags: wc.tags.map((t) => t.name),
      attributes: {
        woo_id: wc.id,
        channel_id: channelId,
        woo_permalink: wc.permalink,
        variant_attribute_keys: selectedVariantAttrKeys(wc),
      },
    })
    .select("id")
    .single()
  if (productInsert.error) throw new Error(`Producto ${wc.id}: ${productInsert.error.message}`)
  const productId = productInsert.data.id as string

  // Build variants: simple → 1 default variant; variable → fetch variations.
  const variantRows: Array<{
    product_id: string
    tenant_id: string
    sku: string | null
    barcode: string | null
    attributes: Record<string, string>
    price: number
    compare_at_price: number | null
    cost: number | null
    stock: number
    low_stock_threshold: number
    weight_grams: number | null
    status: "active" | "disabled"
    position: number
  }> = []

  if (wc.type === "variable") {
    const variations = await fetchVariations(ctx.creds, wc.id)
    variations.forEach((v, idx) => {
      const price = Number.parseFloat(v.price || v.regular_price || "0") || 0
      const compare =
        v.sale_price && v.regular_price && v.sale_price !== v.regular_price
          ? Number.parseFloat(v.regular_price)
          : null
      const stock = v.manage_stock && v.stock_quantity != null ? v.stock_quantity : 0
      const weightGrams = v.weight ? Math.round(Number.parseFloat(v.weight) * 1000) : null
      variantRows.push({
        product_id: productId,
        tenant_id: tenantId,
        sku: v.sku || null,
        barcode: null,
        attributes: variationAttributesToObject(v, wc),
        price,
        compare_at_price: compare,
        cost: null,
        stock,
        low_stock_threshold: 0,
        weight_grams: weightGrams,
        status: v.stock_status === "outofstock" && stock === 0 ? "disabled" : "active",
        position: idx,
      })
    })
  } else {
    // Simple / external / grouped → single default variant
    const price = Number.parseFloat(wc.price || wc.regular_price || "0") || 0
    const compare =
      wc.sale_price && wc.regular_price && wc.sale_price !== wc.regular_price
        ? Number.parseFloat(wc.regular_price)
        : null
    const stock = wc.manage_stock && wc.stock_quantity != null ? wc.stock_quantity : 0
    variantRows.push({
      product_id: productId,
      tenant_id: tenantId,
      sku: wc.sku || null,
      barcode: null,
      attributes: {},
      price,
      compare_at_price: compare,
      cost: null,
      stock,
      low_stock_threshold: 0,
      weight_grams: wc.weight ? Math.round(Number.parseFloat(wc.weight) * 1000) : null,
      status: wc.stock_status === "outofstock" && stock === 0 ? "disabled" : "active",
      position: 0,
    })
  }

  if (variantRows.length > 0) {
    const variantsInsert = await service.from("product_variants").insert(variantRows).select("id, stock")
    if (variantsInsert.error) throw new Error(`Variants ${wc.id}: ${variantsInsert.error.message}`)

    // Seed initial stock movements so the audit trail starts at the imported amount.
    const movementRows = (variantsInsert.data ?? [])
      .map((row) => ({
        tenant_id: tenantId,
        product_id: productId,
        variant_id: row.id,
        type: "in" as const,
        qty: row.stock,
        reason: "Import inicial desde WooCommerce",
        reference: `wc:${wc.id}`,
      }))
      .filter((m) => m.qty > 0)
    if (movementRows.length > 0) {
      await service.from("stock_movements").insert(movementRows)
    }
  }

  // Download images sequentially to avoid rate-limit spikes against the WP
  // host. WC themes commonly cache images via a CDN, so this is fine.
  const imageRows: Array<{
    tenant_id: string
    product_id: string
    variant_id: string | null
    storage_key: string
    url: string
    alt: string | null
    position: number
    is_primary: boolean
    mime_type: string | null
    size_bytes: number | null
  }> = []
  for (let i = 0; i < wc.images.length; i++) {
    const img = wc.images[i]
    const uploaded = await downloadAndUploadImage(ctx, productId, img.src)
    if (!uploaded) continue
    imageRows.push({
      tenant_id: tenantId,
      product_id: productId,
      variant_id: null,
      storage_key: uploaded.storageKey,
      url: uploaded.publicUrl,
      alt: img.alt || null,
      position: i,
      is_primary: i === 0,
      mime_type: uploaded.mime,
      size_bytes: uploaded.size,
    })
  }
  if (imageRows.length > 0) {
    await service.from("product_images").insert(imageRows)
  }

  return true
}

export interface ImportArgs {
  tenantId: string
  channelId: string
  creds: WooCredentials
  currency: string
}

/**
 * Run the full import. Synchronous w.r.t. the caller — for very large catalogs
 * this should be moved to a background queue, but Vercel functions allow
 * up to 5 min so we ride that envelope for v1.
 */
export async function runWooImport(args: ImportArgs): Promise<ImportSummary> {
  const startedAt = new Date().toISOString()
  const service = createServiceClient()
  const productTypeId = await ensureWooProductType(service, args.tenantId)

  const ctx: Ctx = {
    tenantId: args.tenantId,
    channelId: args.channelId,
    productTypeId,
    service,
    r2: getR2(),
    creds: args.creds,
    currency: args.currency,
  }

  const progress: ImportProgress = { total: 0, imported: 0, skipped: 0, failed: 0, errors: [] }

  for await (const product of iterateProducts(args.creds)) {
    progress.total += 1
    try {
      const created = await importOneProduct(ctx, product)
      if (created) progress.imported += 1
      else progress.skipped += 1
    } catch (err) {
      progress.failed += 1
      const message = err instanceof Error ? err.message : String(err)
      progress.errors.push(`#${product.id} ${product.name}: ${message}`)
    }
  }

  const finishedAt = new Date().toISOString()

  // Stamp the channel with the import outcome so the UI shows when it ran.
  await service
    .from("sales_channels")
    .update({
      last_synced_at: finishedAt,
      status: progress.failed === progress.total && progress.total > 0 ? "error" : "connected",
      last_error: progress.errors.length > 0 ? progress.errors.slice(0, 3).join(" | ") : null,
      metadata: {
        last_import: { startedAt, finishedAt, ...progress },
      },
    })
    .eq("id", args.channelId)

  return { ...progress, channelId: args.channelId, startedAt, finishedAt }
}
