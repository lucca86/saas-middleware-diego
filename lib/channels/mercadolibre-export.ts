/**
 * MercadoLibre SC → ML export (bulk publish / update).
 *
 * For each product in the SC catalog:
 *   - If no mapping exists → create a new ML item (POST /items) + upload images.
 *   - If mapping exists   → update price, stock, status (PUT /items/{id}).
 *
 * Constraints:
 *   - ML requires a category_id. We use metadata.ml_category_id stored per
 *     product_type, or fall back to a configurable default on the channel.
 *   - Images must be uploaded via POST /pictures/items/upload first.
 *   - Access token is auto-refreshed by getMLAccessToken().
 */

import { createServiceClient } from "@/lib/supabase/service"
import {
  createMLItem,
  updateMLItem,
  uploadMLPicture,
  getMLAccessToken,
  fetchMLCategoryAttributes,
} from "./mercadolibre"
import { writeSyncLogPush } from "./sync-log"

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface MLExportProgress {
  type: "progress" | "done" | "error"
  current?: number
  total?: number
  productName?: string
  action?: "created" | "updated" | "skipped" | "failed"
  summary?: MLExportSummary
  error?: string
}

export interface MLExportSummary {
  total: number
  created: number
  updated: number
  skipped: number
  failed: number
  errors: string[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Fetch required attributes for a category and build the minimal attributes
 * array ML needs. For each required attribute:
 *   - If it has allowed values, use the first one.
 *   - For free-text attributes, send value_name: "Otro".
 * This avoids a 400 on first publish; users can refine later.
 */
async function buildRequiredAttributes(
  categoryId: string,
): Promise<Array<{ id: string; value_id?: string; value_name?: string }>> {
  try {
    const attrs = await fetchMLCategoryAttributes(categoryId)
    return attrs
      .filter((a) => a.tags?.required === true || a.tags?.["required"] === true)
      .map((a) => {
        if (a.values && a.values.length > 0) {
          return { id: a.id, value_id: a.values[0].id, value_name: a.values[0].name }
        }
        return { id: a.id, value_name: "Otro" }
      })
  } catch {
    return []
  }
}

// ─── Main export runner ────────────────────────────────────────────────────────

export async function* runMLExport(opts: {
  tenantId: string
  channelId: string
  siteId?: string
}): AsyncGenerator<MLExportProgress> {
  const { tenantId, channelId, siteId = "MLA" } = opts
  const service = createServiceClient()

  // Load channel metadata (default category, currency, listing type)
  const { data: channel } = await service
    .from("sales_channels")
    .select("external_id, metadata, currency")
    .eq("id", channelId)
    .maybeSingle()

  if (!channel) {
    yield { type: "error", error: "Canal no encontrado." }
    return
  }

  const meta = (channel.metadata ?? {}) as Record<string, unknown>
  const defaultCategoryId = (meta.default_ml_category_id as string | undefined) ?? null
  const defaultListingType = (meta.default_listing_type as string | undefined) ?? "gold_special"
  const currency = channel.currency ?? "ARS"

  if (!defaultCategoryId) {
    yield {
      type: "error",
      error:
        "No hay categoría de ML configurada. Editá el canal y completá el campo 'Categoría ML por defecto'.",
    }
    return
  }

  // Load all active/draft products with variants and images
  const { data: products, error: prodErr } = await service
    .from("products")
    .select(`
      id, name, description, status, sku,
      product_variants ( id, sku, price, compare_at_price, stock, status, attributes ),
      product_images ( url, position, alt, is_primary )
    `)
    .eq("tenant_id", tenantId)
    .in("status", ["active", "draft"])
    .order("created_at", { ascending: true })

  if (prodErr || !products?.length) {
    yield { type: "done", summary: { total: 0, created: 0, updated: 0, skipped: 0, failed: 0, errors: [] } }
    return
  }

  const summary: MLExportSummary = {
    total: products.length,
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  }

  // Cache required attributes per category to avoid repeated API calls
  const categoryAttrsCache = new Map<string, Array<{ id: string; value_id?: string; value_name?: string }>>()

  // Load existing mappings for this channel
  const { data: mappings } = await service
    .from("channel_product_mappings")
    .select("product_id, variant_id, external_product_id, external_variant_id")
    .eq("channel_id", channelId)

  const mappingByProduct = new Map<string, { external_product_id: string }>()
  const mappingByVariant = new Map<string, string>()
  for (const m of mappings ?? []) {
    if (m.product_id && m.external_product_id) {
      mappingByProduct.set(m.product_id, { external_product_id: m.external_product_id })
    }
    if (m.variant_id && m.external_variant_id) {
      mappingByVariant.set(m.variant_id, m.external_variant_id)
    }
  }

  for (let i = 0; i < products.length; i++) {
    const product = products[i]
    const productName = (product.name as string) ?? "Producto"

    yield { type: "progress", current: i + 1, total: products.length, productName }

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

    // Representative variant (first active, or first)
    const mainVariant =
      variants.find((v) => v.status === "active") ?? variants[0]

    if (!mainVariant) {
      summary.skipped++
      yield { type: "progress", current: i + 1, total: products.length, productName, action: "skipped" }
      continue
    }

    const existingMapping = mappingByProduct.get(product.id)

    try {
      if (existingMapping) {
        // ── UPDATE existing ML item ──────────────────────────────────────────
        const itemId = existingMapping.external_product_id

        await updateMLItem(channelId, itemId, {
          price: mainVariant.price,
          available_quantity: Math.max(0, mainVariant.stock ?? 0),
          status: product.status === "active" ? "active" : "paused",
          ...(product.description && { description: product.description as string }),
        })

        summary.updated++
        yield { type: "progress", current: i + 1, total: products.length, productName, action: "updated" }

        void writeSyncLogPush({
          tenantId,
          channelId,
          eventType: "push_product",
          status: "ok",
          summary: `ML actualizado: ${productName}`,
          productId: product.id,
        })
      } else {
        // ── CREATE new ML item ───────────────────────────────────────────────

        // Upload images to ML's CDN first
        const mlPictureIds: string[] = []
        for (const img of images.slice(0, 6)) {
          try {
            const uploaded = await uploadMLPicture(channelId, img.url)
            if (uploaded?.id) mlPictureIds.push(uploaded.id)
          } catch {
            // Non-fatal — continue without this image
          }
        }

        // Listing types that require at least 1 picture
        const picRequiredTypes = ["gold_special", "gold_pro", "gold_premium"]
        const effectiveListingType =
          mlPictureIds.length === 0 && picRequiredTypes.includes(defaultListingType)
            ? "gold_premium" // gold_premium allows publishing without pictures
            : defaultListingType

        // Fetch + cache required category attributes
        if (!categoryAttrsCache.has(defaultCategoryId)) {
          const attrs = await buildRequiredAttributes(defaultCategoryId)
          categoryAttrsCache.set(defaultCategoryId, attrs)
        }
        const requiredAttributes = categoryAttrsCache.get(defaultCategoryId) ?? []

        const payload: Record<string, unknown> = {
          title: productName,
          category_id: defaultCategoryId,
          price: mainVariant.price,
          currency_id: currency,
          available_quantity: Math.max(0, mainVariant.stock ?? 0),
          buying_mode: "buy_it_now",
          listing_type_id: effectiveListingType,
          condition: "new",
          seller_custom_field: mainVariant.sku ?? product.sku ?? null,
          ...(product.description && { description: product.description as string }),
          ...(mlPictureIds.length > 0 && {
            pictures: mlPictureIds.map((id) => ({ id })),
          }),
          ...(requiredAttributes.length > 0 && { attributes: requiredAttributes }),
        }

        const created = await createMLItem(channelId, payload)

        // Persist the mapping
        await service.from("channel_product_mappings").upsert(
          {
            channel_id: channelId,
            product_id: product.id,
            variant_id: mainVariant.id,
            external_product_id: created.id,
            external_variant_id: null,
            synced_at: new Date().toISOString(),
          },
          { onConflict: "channel_id,product_id,variant_id" },
        )
        mappingByProduct.set(product.id, { external_product_id: created.id })

        summary.created++
        yield { type: "progress", current: i + 1, total: products.length, productName, action: "created" }

        void writeSyncLogPush({
          tenantId,
          channelId,
          eventType: "push_product",
          status: "ok",
          summary: `ML creado: ${productName} (${created.id})`,
          productId: product.id,
        })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      summary.failed++
      summary.errors.push(`${productName}: ${message}`)
      yield { type: "progress", current: i + 1, total: products.length, productName, action: "failed" }

      void writeSyncLogPush({
        tenantId,
        channelId,
        eventType: "push_product",
        status: "error",
        summary: `Error ML ${productName}: ${message}`,
        productId: product.id,
      })
    }
  }

  // Persist export summary to channel metadata
  await service
    .from("sales_channels")
    .update({
      last_synced_at: new Date().toISOString(),
      metadata: {
        ...meta,
        last_export: new Date().toISOString(),
        last_export_summary: summary,
      },
    })
    .eq("id", channelId)

  void writeSyncLogPush({
    tenantId,
    channelId,
    eventType: "push_product",
    status: summary.failed > 0 ? (summary.created + summary.updated > 0 ? "partial" : "error") : "ok",
    summary: `ML export: ${summary.created} creados, ${summary.updated} actualizados, ${summary.skipped} omitidos, ${summary.failed} fallaron de ${summary.total}.`,
  })

  yield { type: "done", summary }
}
