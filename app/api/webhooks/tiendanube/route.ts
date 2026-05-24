import "server-only"
import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"
import { writeSyncLogWebhook } from "@/lib/channels/sync-log"
import { pickLocalized } from "@/lib/channels/tiendanube"

/**
 * TiendaNube → Stockcurve webhook receiver.
 *
 * TN sends a POST to this URL with:
 *  - Header `x-tiendanube-topic` : e.g. "order/created"
 *  - Header `x-tiendanube-token` : the store's access_token (used to verify ownership)
 *  - Header `x-store-id`         : the store ID (storeId = external_id in SC)
 *
 * No HMAC — we verify by matching access_token + store_id against a connected channel.
 *
 * URL format: /api/webhooks/tiendanube?channel={channelId}
 *
 * Supported events:
 *  - order/created, order/updated, order/paid  → upsert SC order + deduct stock
 *  - product/updated                           → sync stock changes back to SC
 *  - product/deleted                           → archive SC product
 */

const MAX_BODY_BYTES = 1_048_576 // 1 MB

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url)
  const channelId = searchParams.get("channel")

  if (!channelId) {
    return NextResponse.json({ error: "Missing channel param" }, { status: 400 })
  }

  const rawBody = await request.text()
  if (rawBody.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 })
  }

  const hdrs = await headers()
  const topic = hdrs.get("x-tiendanube-topic") ?? hdrs.get("x-nuvemshop-topic") ?? ""
  const token = hdrs.get("x-tiendanube-token") ?? hdrs.get("x-nuvemshop-token") ?? ""
  const storeIdHeader = hdrs.get("x-store-id") ?? ""

  const service = createServiceClient()

  // Load the channel and verify ownership via access_token + store_id.
  const { data: channel } = await service
    .from("sales_channels")
    .select("id, tenant_id, external_id, access_token, metadata, status")
    .eq("id", channelId)
    .eq("provider", "tiendanube")
    .maybeSingle()

  if (!channel) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 })
  }

  // Verify: the token header must match the stored access_token, and
  // the store_id header must match external_id.
  const tokenValid = !token || token === (channel.access_token ?? "")
  const storeValid = !storeIdHeader || storeIdHeader === String(channel.external_id ?? "")
  if (!tokenValid || !storeValid) {
    console.error("[v0] TN webhook: auth mismatch for channel", channelId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  // Always respond 200 immediately — TN retries if it doesn't get 2xx.
  // Process async after returning.
  try {
    if (topic === "order/created" || topic === "order/updated" || topic === "order/paid") {
      await handleOrderEvent(service, channel.tenant_id, channelId, payload)
      void writeSyncLogWebhook({
        tenantId: channel.tenant_id,
        channelId,
        eventType: "webhook_order",
        status: "ok",
        summary: `Pedido TN #${payload.id} (${payload.status}) recibido vía webhook.`,
        payload: { tn_order_id: payload.id, status: payload.status, topic },
      })
    } else if (topic === "product/updated") {
      await handleProductUpdated(service, channel.tenant_id, channelId, payload)
      void writeSyncLogWebhook({
        tenantId: channel.tenant_id,
        channelId,
        eventType: "webhook_product",
        status: "ok",
        summary: `Producto TN #${payload.id} actualizado vía webhook.`,
        payload: { tn_product_id: payload.id, topic },
      })
    } else if (topic === "product/deleted") {
      await handleProductDeleted(service, channel.tenant_id, channelId, payload)
      void writeSyncLogWebhook({
        tenantId: channel.tenant_id,
        channelId,
        eventType: "webhook_product",
        status: "ok",
        summary: `Producto TN #${payload.id} eliminado en TN → archivado en SC.`,
        payload: { tn_product_id: payload.id, topic },
      })
    } else {
      console.log("[v0] TN webhook: unhandled topic", topic)
    }
  } catch (err) {
    console.error("[v0] TN webhook handler error:", err)
    void writeSyncLogWebhook({
      tenantId: channel.tenant_id,
      channelId,
      eventType: topic.startsWith("order") ? "webhook_order" : "webhook_product",
      status: "error",
      summary: err instanceof Error ? err.message : String(err),
      payload: { topic, tn_id: payload?.id },
    })
  }

  return NextResponse.json({ ok: true })
}

// ─── Order handler ────────────────────────────────────────────────────────────

async function handleOrderEvent(
  service: ReturnType<typeof createServiceClient>,
  tenantId: string,
  channelId: string,
  tn: Record<string, unknown>,
) {
  const tnOrderId = String(tn.id)
  const status = mapTnOrderStatus(String(tn.status ?? ""))
  const currency = String(tn.currency ?? "ARS")

  // Customer info — TN nests contact_name + contact_email at order root.
  const customerName = String(tn.contact_name ?? "").trim() || "—"
  const customerEmail = (tn.contact_email as string) ?? null
  const customerPhone = (tn.contact_phone as string) ?? null
  const notes = String(tn.note ?? "").trim() || null

  const lineItems = (tn.products as unknown[]) ?? []
  let total = Number(tn.total ?? 0)
  if (!total) {
    total = lineItems.reduce((sum, item) => {
      const i = item as Record<string, unknown>
      return sum + Number(i.total_price ?? Number(i.price ?? 0) * Number(i.quantity ?? 1))
    }, 0)
  }

  const orderItems: Array<{
    variant_id: string | null
    product_id: string | null
    qty: number
    unit_price: number
    total_price: number
    snapshot: Record<string, unknown>
  }> = []

  for (const item of lineItems as Record<string, unknown>[]) {
    const tnProductId = String(item.product_id ?? "")
    const tnVariantId = item.variant_id ? String(item.variant_id) : null
    const qty = Number(item.quantity ?? 1)
    const unitPrice = Number(item.price ?? 0)
    const itemTotal = Number(item.total_price ?? unitPrice * qty)

    let productId: string | null = null
    let variantId: string | null = null

    if (tnVariantId) {
      const { data: m } = await service
        .from("channel_product_mappings")
        .select("product_id, variant_id")
        .eq("tenant_id", tenantId)
        .eq("channel_id", channelId)
        .eq("external_product_id", tnProductId)
        .eq("external_variant_id", tnVariantId)
        .maybeSingle()
      productId = (m?.product_id as string) ?? null
      variantId = (m?.variant_id as string) ?? null
    }

    const name =
      typeof item.name === "object" && item.name !== null
        ? pickLocalized(item.name as Record<string, string>)
        : String(item.name ?? "")

    orderItems.push({
      product_id: productId,
      variant_id: variantId,
      qty,
      unit_price: unitPrice,
      total_price: itemTotal,
      snapshot: { name, sku: item.sku, tn_item_id: item.product_id, tn_variant_id: item.variant_id },
    })
  }

  // Dedup by tn_order_id stored in attributes.
  const { data: existing } = await service
    .from("orders")
    .select("id, status")
    .eq("tenant_id", tenantId)
    .contains("attributes", { tn_order_id: tnOrderId, channel_id: channelId })
    .maybeSingle()

  if (existing?.id) {
    await service
      .from("orders")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", existing.id)
    return
  }

  const { data: maxRow } = await service
    .from("orders")
    .select("code")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const lastNum = maxRow?.code ? parseInt((maxRow.code as string).replace("ORD-", ""), 10) : 0
  const code = `ORD-${String(lastNum + 1).padStart(4, "0")}`

  const { data: newOrder } = await service
    .from("orders")
    .insert({
      tenant_id: tenantId,
      code,
      status,
      currency,
      customer_name: customerName,
      customer_email: customerEmail,
      customer_phone: customerPhone,
      notes,
      total,
      attributes: { tn_order_id: tnOrderId, channel_id: channelId, source: "tiendanube" },
    })
    .select("id")
    .single()

  if (!newOrder?.id) return

  if (orderItems.length > 0) {
    await service.from("order_items").insert(
      orderItems.map((item) => ({
        order_id: newOrder.id,
        tenant_id: tenantId,
        product_id: item.product_id,
        variant_id: item.variant_id,
        qty: item.qty,
        unit_price: item.unit_price,
        total_price: item.total_price,
        snapshot: item.snapshot,
      })),
    )

    // Deduct stock for each mapped variant.
    for (const item of orderItems) {
      if (!item.variant_id || !item.product_id) continue
      await service.from("stock_movements").insert({
        tenant_id: tenantId,
        product_id: item.product_id,
        variant_id: item.variant_id,
        type: "sale",
        qty: -item.qty,
        reason: `Venta TiendaNube ${tnOrderId}`,
        reference: `tn:${tnOrderId}`,
      })
    }
  }
}

// ─── Product updated handler ──────────────────────────────────────────────────

async function handleProductUpdated(
  service: ReturnType<typeof createServiceClient>,
  tenantId: string,
  channelId: string,
  tn: Record<string, unknown>,
) {
  const tnProductId = String(tn.id)
  const variants = (tn.variants as unknown[]) ?? []

  for (const v of variants as Record<string, unknown>[]) {
    const tnVariantId = String(v.id)
    const { data: mapping } = await service
      .from("channel_product_mappings")
      .select("variant_id")
      .eq("tenant_id", tenantId)
      .eq("channel_id", channelId)
      .eq("external_product_id", tnProductId)
      .eq("external_variant_id", tnVariantId)
      .maybeSingle()

    if (!mapping?.variant_id) continue

    // Sync stock back only if TN manages it and SC doesn't have a pending movement.
    const inventoryLevels = (v.inventory_levels as unknown[]) ?? []
    const stock =
      inventoryLevels.length > 0
        ? (inventoryLevels[0] as Record<string, unknown>).stock
        : v.stock

    if (typeof stock === "number") {
      await service
        .from("product_variants")
        .update({ stock })
        .eq("id", mapping.variant_id)
        .eq("tenant_id", tenantId)
    }
  }
}

// ─── Product deleted handler ──────────────────────────────────────────────────

async function handleProductDeleted(
  service: ReturnType<typeof createServiceClient>,
  tenantId: string,
  channelId: string,
  tn: Record<string, unknown>,
) {
  const tnProductId = String(tn.id)
  const { data: mapping } = await service
    .from("channel_product_mappings")
    .select("product_id")
    .eq("tenant_id", tenantId)
    .eq("channel_id", channelId)
    .eq("external_product_id", tnProductId)
    .is("external_variant_id", null)
    .maybeSingle()

  if (!mapping?.product_id) return

  // Archive in SC rather than deleting — keeps the history intact.
  await service
    .from("products")
    .update({ status: "archived" })
    .eq("id", mapping.product_id)
    .eq("tenant_id", tenantId)
}

// ─── Status mapping ───────────────────────────────────────────────────────────

function mapTnOrderStatus(tnStatus: string): "pending" | "confirmed" | "fulfilled" | "cancelled" {
  switch (tnStatus) {
    case "open":
    case "packed":
      return "confirmed"
    case "fulfilled":
    case "closed":
      return "fulfilled"
    case "cancelled":
      return "cancelled"
    default:
      return "pending"
  }
}
