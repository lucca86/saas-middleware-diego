/**
 * Stockcurve → TiendaNube push.
 *
 * Mirrors woocommerce-push.ts. Called from:
 *  - product/variant save actions (price, name, published, description)
 *  - stock_movements insert (qty adjustments)
 *
 * All errors are swallowed and logged — a TN outage must never break SC.
 */
import { createServiceClient } from "@/lib/supabase/service"
import {
  updateTiendaNubeProduct,
  updateTiendaNubeVariant,
} from "./tiendanube"
import { writeSyncLogPush } from "./sync-log"

interface PushProductPayload {
  name?: string
  status?: "active" | "draft" | "archived"
  description?: string | null
}

interface PushVariantPayload {
  price?: number
  compareAtPrice?: number | null
  stock?: number
  sku?: string | null
}

type TNChannelCreds = {
  channelId: string
  storeId: string
  accessToken: string
}

/** Load TN credentials for all tiendanube channels in the tenant. */
async function loadTNChannels(tenantId: string): Promise<TNChannelCreds[]> {
  const service = createServiceClient()
  const { data } = await service
    .from("sales_channels")
    .select("id, external_id, access_token")
    .eq("tenant_id", tenantId)
    .eq("provider", "tiendanube")
    .eq("status", "connected")
  return (data ?? []).map((row) => ({
    channelId: row.id as string,
    storeId: row.external_id as string,
    accessToken: row.access_token as string,
  }))
}

/**
 * Push product-level fields (name, published/status, description) to TN.
 */
export async function pushProductToTiendaNube(
  tenantId: string,
  productId: string,
  payload: PushProductPayload,
): Promise<void> {
  const service = createServiceClient()
  const channels = await loadTNChannels(tenantId)
  if (!channels.length) return

  const { data: mappings } = await service
    .from("channel_product_mappings")
    .select("channel_id, external_product_id")
    .eq("tenant_id", tenantId)
    .eq("product_id", productId)
    .is("variant_id", null)
  if (!mappings?.length) return

  for (const channel of channels) {
    const mapping = mappings.find((m) => m.channel_id === channel.channelId)
    if (!mapping?.external_product_id) continue

    const tnPayload: Record<string, unknown> = {}

    if (payload.name !== undefined) {
      // TN requires localized name as { es: "..." }
      tnPayload.name = { es: payload.name }
    }
    if (payload.description !== undefined) {
      tnPayload.description = { es: payload.description ?? "" }
    }
    if (payload.status !== undefined) {
      tnPayload.published = payload.status === "active"
    }

    if (!Object.keys(tnPayload).length) continue

    try {
      await updateTiendaNubeProduct(
        channel.storeId,
        Number(mapping.external_product_id),
        channel.accessToken,
        tnPayload,
      )
      void writeSyncLogPush({
        tenantId,
        channelId: channel.channelId,
        eventType: "push_product",
        status: "ok",
        summary: `Producto actualizado en TN: ${payload.name ?? productId}`,
        productId,
        payload: tnPayload,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[tn-push] pushProduct ${productId}:`, message)
      void writeSyncLogPush({
        tenantId,
        channelId: channel.channelId,
        eventType: "push_product",
        status: "error",
        summary: `Error TN push producto: ${message}`,
        productId,
      })
    }
  }
}

/**
 * Push variant-level fields (price, stock, SKU) to TN.
 * TN stock is written via variant.stock (legacy) — inventory_levels
 * write requires knowing the location_id which we don't cache.
 */
export async function pushVariantToTiendaNube(
  tenantId: string,
  productId: string,
  variantId: string,
  payload: PushVariantPayload,
): Promise<void> {
  const service = createServiceClient()
  const channels = await loadTNChannels(tenantId)
  if (!channels.length) return

  const { data: mappings } = await service
    .from("channel_product_mappings")
    .select("channel_id, external_product_id, external_variant_id")
    .eq("tenant_id", tenantId)
    .eq("variant_id", variantId)
    .not("external_variant_id", "is", null)
  if (!mappings?.length) return

  for (const channel of channels) {
    const mapping = mappings.find((m) => m.channel_id === channel.channelId)
    if (!mapping?.external_product_id || !mapping?.external_variant_id) continue

    const tnPayload: Record<string, unknown> = {}
    if (payload.price !== undefined) tnPayload.price = String(payload.price)
    if (payload.compareAtPrice !== undefined) {
      tnPayload.compare_at_price = payload.compareAtPrice ? String(payload.compareAtPrice) : null
    }
    if (payload.stock !== undefined) tnPayload.stock = payload.stock
    if (payload.sku !== undefined) tnPayload.sku = payload.sku

    if (!Object.keys(tnPayload).length) continue

    try {
      await updateTiendaNubeVariant(
        channel.storeId,
        Number(mapping.external_product_id),
        Number(mapping.external_variant_id),
        channel.accessToken,
        tnPayload,
      )
      void writeSyncLogPush({
        tenantId,
        channelId: channel.channelId,
        eventType:
          payload.stock !== undefined ? ("push_stock" as const) : ("push_product" as const),
        status: "ok",
        summary: `Variante actualizada en TN: ${mapping.external_variant_id}`,
        productId,
        variantId,
        payload: tnPayload,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[tn-push] pushVariant ${variantId}:`, message)
      void writeSyncLogPush({
        tenantId,
        channelId: channel.channelId,
        eventType:
          payload.stock !== undefined ? ("push_stock" as const) : ("push_product" as const),
        status: "error",
        summary: `Error TN push variante: ${message}`,
        productId,
        variantId,
      })
    }
  }
}

/**
 * Convenience wrapper: push a stock quantity to TN for a given SC variant.
 * This is called from stock/actions.ts after recording a stock movement.
 */
export async function pushStockToTiendaNube(
  tenantId: string,
  variantId: string,
  newStock: number,
): Promise<void> {
  // productId is resolved internally via the channel_product_mappings query.
  // We pass an empty string for productId and let the mapping lookup handle it.
  return pushVariantToTiendaNube(tenantId, "", variantId, { stock: newStock })
}
