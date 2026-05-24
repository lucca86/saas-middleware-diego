/**
 * Stockcurve → TiendaNube bulk export.
 *
 * Reads products from the SC catalog and creates/updates them in TN.
 * - Products that already have a mapping are skipped (use individual push for updates).
 * - Products without a mapping are CREATED in TN and a mapping is stored.
 * - Variant order in TN must match the SC variants list.
 */
import "server-only"
import { createServiceClient } from "@/lib/supabase/service"
import {
  createTiendaNubeProduct,
  updateTiendaNubeProduct,
  updateTiendaNubeVariant,
  addTiendaNubeProductImage,
  listTiendaNubeProductImages,
} from "./tiendanube"
import { writeSyncLogImport } from "./sync-log"

export interface TiendaNubeExportOptions {
  tenantId: string
  channelId: string
  storeId: string
  accessToken: string
  lang?: string
  onProgress?: (event: TiendaNubeExportProgressEvent) => void
}

export interface TiendaNubeExportProgressEvent {
  phase: "loading" | "exporting" | "done"
  current: number
  total: number
  productName: string
  status: "ok" | "skip" | "error"
  error?: string
}

export interface TiendaNubeExportSummary {
  total: number
  created: number
  updated: number
  skipped: number
  failed: number
  errors: string[]
}

export async function runTiendaNubeExport(
  opts: TiendaNubeExportOptions,
): Promise<TiendaNubeExportSummary> {
  const { tenantId, channelId, storeId, accessToken, lang = "es", onProgress } = opts
  const service = createServiceClient()

  // ── Load all active products for this tenant ──────────────────────────────
  onProgress?.({
    phase: "loading",
    current: 0,
    total: 0,
    productName: "Cargando catálogo…",
    status: "ok",
  })

  const { data: products, error: prodErr } = await service
    .from("products")
    .select(`
      id, name, description, status, attributes,
      product_variants (
        id, sku, price, compare_at_price, stock, status, attributes
      ),
      product_images (
        url, position, alt, is_primary
      )
    `)
    .eq("tenant_id", tenantId)
    .in("status", ["active", "draft"])
    .order("created_at", { ascending: true })

  if (prodErr) throw new Error(`Error cargando catálogo: ${prodErr.message}`)
  const total = (products ?? []).length

  // ── Load existing mappings to detect what's already in TN ─────────────────
  const { data: existingMappings } = await service
    .from("channel_product_mappings")
    .select("product_id, variant_id, external_product_id, external_variant_id")
    .eq("channel_id", channelId)
    .eq("tenant_id", tenantId)

  const mappedProductIds = new Set(
    (existingMappings ?? [])
      .filter((m) => !m.variant_id)
      .map((m) => m.product_id as string),
  )
  const mappedVariantIds = new Map(
    (existingMappings ?? [])
      .filter((m) => m.variant_id)
      .map((m) => [m.variant_id as string, m.external_variant_id as string]),
  )

  const summary: TiendaNubeExportSummary = {
    total,
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  }

  for (let i = 0; i < (products ?? []).length; i++) {
    const product = products![i]
    const productName = product.name ?? `Producto ${product.id}`
    const variants = (product.product_variants ?? []) as Array<{
      id: string
      sku: string | null
      price: number
      compare_at_price: number | null
      stock: number | null
      status: string
      attributes: Record<string, string[]> | null
    }>

    const images = ((product.product_images ?? []) as Array<{
      url: string
      position: number
      alt: string | null
      is_primary: boolean
    }>)
      .filter((img) => img.url)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))

    // ── Determine attribute structure ─────────────────────────────────────
    // Collect unique attribute keys across all variants to build TN attributes array.
    const attrKeys = new Set<string>()
    for (const v of variants) {
      for (const key of Object.keys(v.attributes ?? {})) attrKeys.add(key)
    }

    // ── Build TN product payload ──────────────────────────────────────────
    const attributes = Array.from(attrKeys).map((key) => ({
      en: key,
      es: key,
    }))

    const tnVariants = variants.map((v) => {
      const attrValues = Array.from(attrKeys).map((key) => {
        const vals = v.attributes?.[key] ?? []
        return { en: vals[0] ?? "", es: vals[0] ?? "" }
      })
      return {
        price: String(v.price ?? 0),
        stock: v.stock ?? 0,
        stock_management: true,
        sku: v.sku ?? null,
        values: attrValues,
      }
    })

    const tnPayload: Record<string, unknown> = {
      name: { [lang]: productName },
      description: { [lang]: product.description ?? "" },
      published: product.status === "active",
      attributes,
      variants: tnVariants,
      // Images are uploaded separately after creation via POST /products/{id}/images
    }

    try {
      if (mappedProductIds.has(product.id)) {
        // ── Already mapped → update product-level fields only ──────────────
        const mapping = (existingMappings ?? []).find(
          (m) => m.product_id === product.id && !m.variant_id,
        )
        if (mapping?.external_product_id) {
          await updateTiendaNubeProduct(
            storeId,
            Number(mapping.external_product_id),
            accessToken,
            {
              name: tnPayload.name,
              description: tnPayload.description,
              published: tnPayload.published,
            },
          )

          // Upload any images not yet in TN (compare by src URL).
          if (images.length > 0) {
            const existingImgs = await listTiendaNubeProductImages(
              storeId,
              Number(mapping.external_product_id),
              accessToken,
            )
            const existingSrcs = new Set(existingImgs.map((i) => i.src))
            for (let ii = 0; ii < images.length; ii++) {
              if (!existingSrcs.has(images[ii].url)) {
                try {
                  await addTiendaNubeProductImage(
                    storeId,
                    Number(mapping.external_product_id),
                    accessToken,
                    images[ii].url,
                    ii + 1,
                  )
                } catch {
                  // Non-fatal — skip this image.
                }
              }
            }
          }
          // Update variants that already have mappings.
          for (const v of variants) {
            const extVariantId = mappedVariantIds.get(v.id)
            if (!extVariantId) continue
            await updateTiendaNubeVariant(
              storeId,
              Number(mapping.external_product_id),
              Number(extVariantId),
              accessToken,
              {
                price: String(v.price ?? 0),
                stock: v.stock ?? 0,
                sku: v.sku ?? null,
              },
            )
          }
          summary.updated++
          onProgress?.({ phase: "exporting", current: i + 1, total, productName, status: "ok" })
        } else {
          summary.skipped++
          onProgress?.({ phase: "exporting", current: i + 1, total, productName, status: "skip" })
        }
      } else {
        // ── Not mapped → CREATE in TN ─────────────────────────────────────
        const created = await createTiendaNubeProduct(storeId, accessToken, tnPayload)

        // Upload images via POST /products/{id}/images (separate endpoint).
        for (let ii = 0; ii < images.length; ii++) {
          try {
            await addTiendaNubeProductImage(
              storeId,
              created.id,
              accessToken,
              images[ii].url,
              ii + 1,
            )
          } catch {
            // Image upload failure is non-fatal — log and continue.
          }
        }

        // Store product-level mapping.
        await service.from("channel_product_mappings").insert({
          tenant_id: tenantId,
          channel_id: channelId,
          product_id: product.id,
          variant_id: null,
          external_product_id: String(created.id),
          external_variant_id: null,
          last_synced_at: new Date().toISOString(),
          sync_direction: "both",
        })

        // Store variant-level mappings — match by position.
        for (let vi = 0; vi < variants.length; vi++) {
          const scVariant = variants[vi]
          const tnVariant = created.variants?.[vi]
          if (!tnVariant) continue
          await service.from("channel_product_mappings").insert({
            tenant_id: tenantId,
            channel_id: channelId,
            product_id: product.id,
            variant_id: scVariant.id,
            external_product_id: String(created.id),
            external_variant_id: String(tnVariant.id),
            last_synced_at: new Date().toISOString(),
            sync_direction: "both",
          })
        }

        summary.created++
        onProgress?.({ phase: "exporting", current: i + 1, total, productName, status: "ok" })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      summary.failed++
      summary.errors.push(`${productName}: ${message}`)
      onProgress?.({ phase: "exporting", current: i + 1, total, productName, status: "error", error: message })
    }
  }

  onProgress?.({ phase: "done", current: total, total, productName: "Export completo", status: summary.failed > 0 && summary.created === 0 && summary.updated === 0 ? "error" : "ok" })

  // Write sync log entry.
  void writeSyncLogImport({
    tenantId,
    channelId,
    status:
      summary.failed > 0 && summary.created === 0 && summary.updated === 0
        ? "error"
        : summary.failed > 0
        ? "partial"
        : "ok",
    summary: `Export TN: ${summary.created} creados, ${summary.updated} actualizados, ${summary.skipped} omitidos, ${summary.failed} fallaron de ${summary.total}.`,
    payload: summary as unknown as Record<string, unknown>,
  })

  // Update channel last_synced_at.
  await service
    .from("sales_channels")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("id", channelId)

  return summary
}
