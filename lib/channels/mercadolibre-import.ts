/**
 * MercadoLibre ML → SC import.
 *
 * Fetches all active items for the connected seller and upserts them
 * into the SC catalog with channel_product_mappings for bidirectional sync.
 */

import { createServiceClient } from "@/lib/supabase/service"
import { iterateMLSellerItems, fetchMLItem } from "./mercadolibre"
import { writeSyncLogImport } from "./sync-log"

export interface MLImportSummary {
  total: number
  imported: number
  skipped: number
  failed: number
  errors: string[]
}

export interface MLImportProgress {
  type: "progress" | "done" | "error"
  current?: number
  total?: number
  itemId?: string
  title?: string
  action?: "imported" | "skipped" | "failed"
  summary?: MLImportSummary
  error?: string
}

export async function* runMLImport(opts: {
  tenantId: string
  channelId: string
  mlUserId: number
}): AsyncGenerator<MLImportProgress> {
  const { tenantId, channelId, mlUserId } = opts
  const service = createServiceClient()

  // Collect all item IDs first for progress tracking
  const itemIds: string[] = []
  try {
    for await (const id of iterateMLSellerItems(channelId, mlUserId)) {
      itemIds.push(id)
    }
  } catch (err) {
    yield { type: "error", error: err instanceof Error ? err.message : String(err) }
    return
  }

  if (!itemIds.length) {
    yield { type: "done", summary: { total: 0, imported: 0, skipped: 0, failed: 0, errors: [] } }
    return
  }

  const summary: MLImportSummary = {
    total: itemIds.length,
    imported: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  }

  // Load existing mappings to detect already-imported items
  const { data: existingMappings } = await service
    .from("channel_product_mappings")
    .select("external_product_id, product_id")
    .eq("channel_id", channelId)

  const mappedExternalIds = new Set(
    (existingMappings ?? []).map((m) => m.external_product_id).filter(Boolean),
  )

  for (let i = 0; i < itemIds.length; i++) {
    const itemId = itemIds[i]
    yield { type: "progress", current: i + 1, total: itemIds.length, itemId }

    try {
      const item = await fetchMLItem(channelId, itemId)

      // Skip if already mapped (will be updated on next export run instead)
      if (mappedExternalIds.has(itemId)) {
        summary.skipped++
        yield { type: "progress", current: i + 1, total: itemIds.length, itemId, title: item.title, action: "skipped" }
        continue
      }

      // Determine price and stock from item or first variation
      const price =
        item.variations?.length > 0
          ? (item.variations[0].price ?? item.price)
          : item.price

      const stock =
        item.variations?.length > 0
          ? item.variations.reduce((s: number, v) => s + (v.available_quantity ?? 0), 0)
          : (item.available_quantity ?? 0)

      const sku = item.seller_custom_field ?? null

      // Upsert the product
      const { data: product, error: productErr } = await service
        .from("products")
        .upsert(
          {
            tenant_id: tenantId,
            name: item.title,
            description: null,
            status: item.status === "active" ? "active" : "draft",
            sku: sku ?? undefined,
            source_channel_id: channelId,
          },
          { onConflict: "tenant_id,sku", ignoreDuplicates: false },
        )
        .select("id")
        .single()

      if (productErr || !product) {
        throw new Error(productErr?.message ?? "No se pudo guardar el producto")
      }

      // Upsert main variant
      const { data: variant, error: variantErr } = await service
        .from("product_variants")
        .upsert(
          {
            product_id: product.id,
            sku: sku ? `${sku}-ml` : `ml-${itemId}`,
            price,
            stock,
            status: item.status === "active" ? "active" : "draft",
          },
          { onConflict: "product_id,sku", ignoreDuplicates: false },
        )
        .select("id")
        .single()

      if (variantErr || !variant) {
        throw new Error(variantErr?.message ?? "No se pudo guardar la variante")
      }

      // Store image if available
      if (item.pictures?.length > 0) {
        const primaryPic = item.pictures[0]
        await service.from("product_images").upsert(
          {
            product_id: product.id,
            url: primaryPic.secure_url ?? primaryPic.url,
            position: 1,
            is_primary: true,
          },
          { onConflict: "product_id,position", ignoreDuplicates: true },
        )
      }

      // Persist mapping
      await service.from("channel_product_mappings").upsert(
        {
          channel_id: channelId,
          product_id: product.id,
          variant_id: variant.id,
          external_product_id: itemId,
          external_variant_id: null,
          synced_at: new Date().toISOString(),
        },
        { onConflict: "channel_id,product_id,variant_id" },
      )
      mappedExternalIds.add(itemId)

      summary.imported++
      yield {
        type: "progress",
        current: i + 1,
        total: itemIds.length,
        itemId,
        title: item.title,
        action: "imported",
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      summary.failed++
      summary.errors.push(`${itemId}: ${message}`)
      yield { type: "progress", current: i + 1, total: itemIds.length, itemId, action: "failed" }
    }
  }

  // Update channel metadata
  const { data: ch } = await service
    .from("sales_channels")
    .select("metadata")
    .eq("id", channelId)
    .maybeSingle()
  const meta = ((ch?.metadata ?? {}) as Record<string, unknown>)

  await service
    .from("sales_channels")
    .update({
      last_synced_at: new Date().toISOString(),
      metadata: {
        ...meta,
        last_import: new Date().toISOString(),
        last_import_summary: summary,
      },
    })
    .eq("id", channelId)

  void writeSyncLogImport({
    tenantId,
    channelId,
    status: summary.failed > 0 ? (summary.imported > 0 ? "partial" : "error") : "ok",
    summary: `ML import: ${summary.imported} importados, ${summary.skipped} omitidos, ${summary.failed} fallaron de ${summary.total}.`,
    payload: summary as unknown as Record<string, unknown>,
  })

  yield { type: "done", summary }
}
