/**
 * Sprint B: Stockcurve → WooCommerce push.
 *
 * After the one-shot import (Sprint A) Stockcurve is the source of truth.
 * This module pushes local changes (price, stock, name, status) to WC for
 * every channel that imported a given product/variant.
 *
 * Called from:
 *  - product/variant save actions (price, name, status changes)
 *  - stock_movements insert (qty adjustments, fulfillments, sales)
 *
 * All errors are swallowed and logged — a WC outage must never break SC.
 */

import { createServiceClient } from "@/lib/supabase/service"
import {
  updateWooProduct,
  updateWooVariation,
  updateWooStock,
  type WooCredentials,
} from "./woocommerce"
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
  status?: "active" | "disabled"
}

type ChannelCreds = WooCredentials & { channelId: string }

/** Load WC credentials for all woocommerce channels in the tenant. */
async function loadWooChannels(tenantId: string): Promise<ChannelCreds[]> {
  const service = createServiceClient()
  const { data } = await service
    .from("sales_channels")
    .select("id, store_url, access_token, refresh_token")
    .eq("tenant_id", tenantId)
    .eq("provider", "woocommerce")
    .eq("status", "connected")
  return (data ?? []).map((row) => ({
    channelId: row.id as string,
    storeUrl: row.store_url as string,
    consumerKey: row.access_token as string,
    consumerSecret: row.refresh_token as string,
  }))
}

/**
 * Push product-level fields (name, status, description) to WC.
 * Safe to call after any product save.
 */
export async function pushProductToWoo(
  tenantId: string,
  productId: string,
  payload: PushProductPayload,
): Promise<void> {
  const service = createServiceClient()
  const channels = await loadWooChannels(tenantId)
  if (!channels.length) return

  // Find all product-level mappings for this product.
  const { data: mappings } = await service
    .from("channel_product_mappings")
    .select("channel_id, external_product_id")
    .eq("tenant_id", tenantId)
    .eq("product_id", productId)
    .is("variant_id", null)
  if (!mappings?.length) return

  const wcPayload: Record<string, unknown> = {}
  if (payload.name) wcPayload.name = payload.name
  if (payload.description !== undefined) wcPayload.description = payload.description ?? ""
  if (payload.status) {
    wcPayload.status =
      payload.status === "active" ? "publish" : payload.status === "draft" ? "draft" : "private"
  }

  for (const mapping of mappings) {
    const creds = channels.find((c) => c.channelId === mapping.channel_id)
    if (!creds) continue
    try {
      await updateWooProduct(creds, Number(mapping.external_product_id), wcPayload)
      await service
        .from("channel_product_mappings")
        .update({ last_synced_at: new Date().toISOString(), sync_direction: "both" })
        .eq("channel_id", mapping.channel_id)
        .eq("external_product_id", mapping.external_product_id)
        .is("variant_id", null)
      void writeSyncLogPush({
        tenantId,
        channelId: mapping.channel_id as string,
        eventType: "push_product",
        status: "ok",
        summary: `Producto actualizado en WooCommerce (${mapping.external_product_id})`,
        productId,
        payload: wcPayload,
      })
    } catch (err) {
      console.error("[sc] pushProductToWoo error:", mapping.channel_id, err)
      void writeSyncLogPush({
        tenantId,
        channelId: mapping.channel_id as string,
        eventType: "push_product",
        status: "error",
        summary: err instanceof Error ? err.message : String(err),
        productId,
      })
    }
  }
}

/**
 * Push variant-level fields (price, stock, sku, status) to WC.
 * Safe to call after any variant save or stock movement.
 */
export async function pushVariantToWoo(
  tenantId: string,
  variantId: string,
  payload: PushVariantPayload,
): Promise<void> {
  const service = createServiceClient()
  const channels = await loadWooChannels(tenantId)
  if (!channels.length) return

  const { data: mappings } = await service
    .from("channel_product_mappings")
    .select("channel_id, external_product_id, external_variant_id")
    .eq("tenant_id", tenantId)
    .eq("variant_id", variantId)
    .not("external_variant_id", "is", null)
  if (!mappings?.length) return

  for (const mapping of mappings) {
    const creds = channels.find((c) => c.channelId === mapping.channel_id)
    if (!creds) continue
    const extProductId = Number(mapping.external_product_id)
    const extVariantId = Number(mapping.external_variant_id)

    try {
      const varPayload: Record<string, unknown> = {}
      if (payload.price !== undefined) varPayload.regular_price = String(payload.price)
      if (payload.compareAtPrice !== undefined)
        varPayload.sale_price =
          payload.compareAtPrice != null ? String(payload.compareAtPrice) : ""
      if (payload.sku !== undefined) varPayload.sku = payload.sku ?? ""
      if (payload.status !== undefined)
        varPayload.stock_status = payload.status === "active" ? "instock" : "outofstock"

      if (Object.keys(varPayload).length > 0) {
        await updateWooVariation(creds, extProductId, extVariantId, varPayload)
      }

      // Stock is a separate WC endpoint.
      if (payload.stock !== undefined) {
        await updateWooStock(creds, extProductId, extVariantId, payload.stock)
      }

      await service
        .from("channel_product_mappings")
        .update({ last_synced_at: new Date().toISOString(), sync_direction: "both" })
        .eq("channel_id", mapping.channel_id)
        .eq("external_product_id", mapping.external_product_id)
        .eq("external_variant_id", mapping.external_variant_id)

      void writeSyncLogPush({
        tenantId,
        channelId: mapping.channel_id as string,
        eventType: payload.stock !== undefined ? "push_stock" : "push_product",
        status: "ok",
        summary: payload.stock !== undefined
          ? `Stock → ${payload.stock} para variante ${mapping.external_variant_id}`
          : `Variante ${mapping.external_variant_id} actualizada en WooCommerce`,
        variantId,
        payload: { ...varPayload, stock: payload.stock },
      })
    } catch (err) {
      console.error("[sc] pushVariantToWoo error:", mapping.channel_id, variantId, err)
      void writeSyncLogPush({
        tenantId,
        channelId: mapping.channel_id as string,
        eventType: payload.stock !== undefined ? "push_stock" : "push_product",
        status: "error",
        summary: err instanceof Error ? err.message : String(err),
        variantId,
      })
    }
  }
}

/**
 * Convenience: push only the stock of a variant to every mapped WC channel.
 * Called from stock_movement hooks.
 */
export async function pushStockToWoo(
  tenantId: string,
  variantId: string,
  newStock: number,
): Promise<void> {
  return pushVariantToWoo(tenantId, variantId, { stock: newStock })
}
