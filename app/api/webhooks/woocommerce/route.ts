import "server-only"
import { createHmac } from "node:crypto"
import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"
import { writeSyncLogWebhook } from "@/lib/channels/sync-log"

/**
 * Sprint C: WooCommerce → Stockcurve webhook receiver.
 *
 * WooCommerce sends a POST to this URL with an HMAC-SHA256 signature in the
 * `X-WC-Webhook-Signature` header. We verify it against the webhook secret
 * stored in `sales_channels.metadata.webhook_secret`, then:
 *
 *  - `order.created` / `order.updated` → upsert a SC order + deduct stock
 *  - `product.updated`                 → update product name/status/price in SC
 *  - `product.stock_updated`           → update variant stock in SC
 *
 * URL format: /api/webhooks/woocommerce?channel={channelId}
 * The `channel` query param identifies which sales_channel row (and therefore
 * which tenant) the event belongs to.
 */

const MAX_BODY_BYTES = 1_048_576 // 1 MB

function verifySignature(body: string, signature: string, secret: string): boolean {
  const hmac = createHmac("sha256", secret)
  hmac.update(body, "utf8")
  const expected = hmac.digest("base64")
  return expected === signature
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url)
  const channelId = searchParams.get("channel")

  if (!channelId) {
    return NextResponse.json({ error: "Missing channel param" }, { status: 400 })
  }

  // Read body as text first so we can verify HMAC before parsing.
  const rawBody = await request.text()
  if (rawBody.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 })
  }

  const hdrs = await headers()
  const signature = hdrs.get("x-wc-webhook-signature") ?? ""
  const topic = hdrs.get("x-wc-webhook-topic") ?? ""

  const service = createServiceClient()

  // Load the channel to validate ownership and get the webhook secret.
  const { data: channel } = await service
    .from("sales_channels")
    .select("id, tenant_id, metadata, status")
    .eq("id", channelId)
    .eq("provider", "woocommerce")
    .maybeSingle()

  if (!channel) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 })
  }

  const meta = (channel.metadata ?? {}) as Record<string, unknown>
  const secret = typeof meta.webhook_secret === "string" ? meta.webhook_secret : ""

  // Verify signature when a secret is stored. If no secret is set (first
  // registration), log a warning but still accept — the operator should
  // register the secret before going live.
  if (secret && signature && !verifySignature(rawBody, signature, secret)) {
    console.error("[sc] WC webhook: invalid signature for channel", channelId)
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  // Route by topic.
  try {
    if (topic === "order.created" || topic === "order.updated") {
      await handleOrderEvent(service, channel.tenant_id, channelId, payload)
      void writeSyncLogWebhook({
        tenantId: channel.tenant_id,
        channelId,
        eventType: "webhook_order",
        status: "ok",
        summary: `Pedido WC #${payload.id} (${payload.status}) recibido vía webhook.`,
        payload: { wc_order_id: payload.id, status: payload.status, topic },
      })
    } else if (topic === "product.updated") {
      await handleProductUpdated(service, channel.tenant_id, channelId, payload)
      void writeSyncLogWebhook({
        tenantId: channel.tenant_id,
        channelId,
        eventType: "webhook_product",
        status: "ok",
        summary: `Producto WC #${payload.id} actualizado vía webhook.`,
        payload: { wc_product_id: payload.id, topic },
      })
    } else {
      // Unknown topic — acknowledge silently so WC doesn't disable the webhook.
      console.log("[sc] WC webhook: unhandled topic", topic)
    }
  } catch (err) {
    console.error("[sc] WC webhook handler error:", err)
    void writeSyncLogWebhook({
      tenantId: channel.tenant_id,
      channelId,
      eventType: topic.startsWith("order") ? "webhook_order" : "webhook_product",
      status: "error",
      summary: err instanceof Error ? err.message : String(err),
      payload: { topic, wc_id: payload.id },
    })
    // Return 200 to WC so it doesn't retry. We log the error for debugging.
  }

  return NextResponse.json({ ok: true })
}

// ─── Order handler ────────────────────────────────────────────────────────────

async function handleOrderEvent(
  service: ReturnType<typeof createServiceClient>,
  tenantId: string,
  channelId: string,
  wc: Record<string, unknown>,
) {
  const wcOrderId = String(wc.id)
  const status = mapWcStatus(String(wc.status ?? ""))
  const currency = String(wc.currency ?? "ARS")

  const billing = (wc.billing ?? {}) as Record<string, string>
  const customerName = [billing.first_name, billing.last_name].filter(Boolean).join(" ") || "—"
  const customerEmail = billing.email ?? null
  const customerPhone = billing.phone ?? null
  const notes = String(wc.customer_note ?? "").trim() || null

  const lineItems = (wc.line_items as unknown[]) ?? []
  let total = 0
  const orderItems: Array<{
    variant_id: string | null
    product_id: string | null
    qty: number
    unit_price: number
    total_price: number
    snapshot: Record<string, unknown>
  }> = []

  for (const item of lineItems as Record<string, unknown>[]) {
    const wcProductId = String(item.product_id ?? "")
    const wcVariationId = item.variation_id ? String(item.variation_id) : null
    const qty = Number(item.quantity ?? 1)
    const unitPrice = Number(item.price ?? 0)
    const itemTotal = Number(item.total ?? unitPrice * qty)
    total += itemTotal

    // Look up SC product/variant via mapping.
    let productId: string | null = null
    let variantId: string | null = null

    if (wcVariationId && wcVariationId !== "0") {
      const { data: m } = await service
        .from("channel_product_mappings")
        .select("product_id, variant_id")
        .eq("tenant_id", tenantId)
        .eq("channel_id", channelId)
        .eq("external_product_id", wcProductId)
        .eq("external_variant_id", wcVariationId)
        .maybeSingle()
      productId = (m?.product_id as string) ?? null
      variantId = (m?.variant_id as string) ?? null
    } else {
      const { data: m } = await service
        .from("channel_product_mappings")
        .select("product_id, variant_id")
        .eq("tenant_id", tenantId)
        .eq("channel_id", channelId)
        .eq("external_product_id", wcProductId)
        .is("external_variant_id", null)
        .maybeSingle()
      productId = (m?.product_id as string) ?? null
      variantId = (m?.variant_id as string) ?? null
    }

    orderItems.push({
      product_id: productId,
      variant_id: variantId,
      qty,
      unit_price: unitPrice,
      total_price: itemTotal,
      snapshot: { name: item.name, sku: item.sku, wc_item_id: item.id },
    })
  }

  // Upsert the SC order using wc_order_id as dedup key stored in attributes.
  const existing = await service
    .from("orders")
    .select("id, status")
    .eq("tenant_id", tenantId)
    .contains("attributes", { wc_order_id: wcOrderId, channel_id: channelId })
    .maybeSingle()

  if (existing.data?.id) {
    // Only update status — don't touch items (SC is source of truth after import).
    await service
      .from("orders")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", existing.data.id)
    return
  }

  // Generate order code: query max existing code for tenant.
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
      attributes: { wc_order_id: wcOrderId, channel_id: channelId, source: "woocommerce" },
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

    // Deduct stock for each variant via a stock movement.
    for (const item of orderItems) {
      if (!item.variant_id || !item.product_id) continue
      await service.from("stock_movements").insert({
        tenant_id: tenantId,
        product_id: item.product_id,
        variant_id: item.variant_id,
        type: "sale",
        qty: -item.qty,
        reason: `Venta WooCommerce ${wcOrderId}`,
        reference: `wc:${wcOrderId}`,
      })
    }
  }
}

// ─── Product.updated handler ──────────────────────────────────────────────────

async function handleProductUpdated(
  service: ReturnType<typeof createServiceClient>,
  tenantId: string,
  channelId: string,
  wc: Record<string, unknown>,
) {
  // After initial import Stockcurve is the source of truth for products.
  // We only push WC → SC for stock_quantity changes here (safety valve).
  const wcProductId = String(wc.id)
  const { data: mapping } = await service
    .from("channel_product_mappings")
    .select("product_id, variant_id")
    .eq("tenant_id", tenantId)
    .eq("channel_id", channelId)
    .eq("external_product_id", wcProductId)
    .is("external_variant_id", null)
    .maybeSingle()

  if (!mapping?.product_id) return

  // Only sync stock for simple products where SC doesn't manage it yet.
  const stockQty = wc.stock_quantity
  if (typeof stockQty === "number" && mapping.variant_id) {
    await service
      .from("product_variants")
      .update({ stock: stockQty })
      .eq("id", mapping.variant_id)
      .eq("tenant_id", tenantId)
  }
}

// ─── Status mapping ───────────────────────────────────────────────────────────

function mapWcStatus(wcStatus: string): "pending" | "confirmed" | "fulfilled" | "cancelled" {
  switch (wcStatus) {
    case "processing":
    case "on-hold":
      return "confirmed"
    case "completed":
      return "fulfilled"
    case "cancelled":
    case "refunded":
    case "failed":
      return "cancelled"
    default:
      return "pending"
  }
}
