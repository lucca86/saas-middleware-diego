import "server-only"
import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"
import { fetchMLItem, fetchMLOrder } from "@/lib/channels/mercadolibre"
import { writeSyncLogWebhook } from "@/lib/channels/sync-log"

/**
 * MercadoLibre → Stockcurve notification receiver.
 *
 * ML sends a POST to this URL (configured in the ML developer portal as the
 * app-level Notification URL). It applies to ALL sellers who have connected
 * the app, identified by `user_id` in the payload.
 *
 * Payload shape:
 *   { topic, resource, user_id, application_id, attempts, sent, received }
 *
 * ML does NOT send a signature. We verify by looking up the user_id against
 * our sales_channels table to ensure the event belongs to a known tenant.
 *
 * ML requires a 200 response within a few seconds or it retries up to 3 times.
 * All heavy processing is done via void promises (fire-and-forget) after the
 * 200 is returned.
 */

export const runtime = "nodejs"

export async function POST(request: Request) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const topic = (body.topic as string) ?? ""
  const resource = (body.resource as string) ?? ""
  const mlUserId = body.user_id ? String(body.user_id) : null

  // Respond 200 immediately — ML retries on non-2xx responses.
  // All processing is fire-and-forget below.
  void processMLNotification({ topic, resource, mlUserId })

  return NextResponse.json({ received: true })
}

async function processMLNotification({
  topic,
  resource,
  mlUserId,
}: {
  topic: string
  resource: string
  mlUserId: string | null
}) {
  if (!mlUserId) return

  const service = createServiceClient()

  // Find the channel connected to this ML user_id
  const { data: channels } = await service
    .from("sales_channels")
    .select("id, tenant_id, metadata")
    .eq("provider", "mercadolibre")
    .eq("external_id", mlUserId)
    .eq("status", "connected")

  if (!channels?.length) return

  // Process for every matching channel (a user_id can only be connected once per tenant,
  // but multiple tenants could theoretically use the same ML account — handle all)
  for (const channel of channels) {
    try {
      if (topic === "orders_v2" || topic === "orders") {
        await handleOrderNotification({ channel, resource, service })
      } else if (topic === "items") {
        await handleItemNotification({ channel, resource, service })
      }
    } catch (err) {
      void writeSyncLogWebhook(channel.id, {
        eventType: "error",
        status: "error",
        summary: `Error procesando notificación ML (${topic}): ${err instanceof Error ? err.message : String(err)}`,
        payload: { topic, resource },
      })
    }
  }
}

async function handleOrderNotification({
  channel,
  resource,
  service,
}: {
  channel: { id: string; tenant_id: string; metadata: unknown }
  resource: string
  service: ReturnType<typeof createServiceClient>
}) {
  // resource is like /orders/12345678 or /orders/v2/12345678
  const orderId = resource.split("/").pop()
  if (!orderId) return

  const order = await fetchMLOrder(channel.id, orderId)

  // Map ML status to SC status
  const statusMap: Record<string, string> = {
    confirmed: "pending",
    payment_required: "pending",
    payment_in_process: "pending",
    partially_refunded: "pending",
    paid: "confirmed",
    cancelled: "cancelled",
  }
  const scStatus = statusMap[order.status] ?? "pending"

  const totalAmount = order.total_amount ?? 0

  // Upsert the order in SC
  const { data: scOrder, error: orderErr } = await service
    .from("orders")
    .upsert(
      {
        tenant_id: channel.tenant_id,
        channel_id: channel.id,
        external_id: String(order.id),
        status: scStatus,
        total: totalAmount,
        currency: order.currency_id ?? "ARS",
        customer_name: order.buyer?.nickname ?? null,
        customer_email: order.buyer?.email ?? null,
        ordered_at: order.date_created,
        raw: order as unknown as Record<string, unknown>,
      },
      { onConflict: "tenant_id,channel_id,external_id" },
    )
    .select("id")
    .single()

  if (orderErr || !scOrder) {
    void writeSyncLogWebhook(channel.id, {
      eventType: "webhook_order",
      status: "error",
      summary: `Error guardando orden ML #${orderId}: ${orderErr?.message ?? "unknown"}`,
    })
    return
  }

  // Upsert order items + deduct stock on payment
  const isPaid = ["paid", "confirmed"].includes(scStatus) && ["paid"].includes(order.status)

  for (const item of order.order_items ?? []) {
    const mlItemId = item.item?.id
    const qty = item.quantity ?? 1
    const sku = item.item?.seller_custom_field ?? null

    // Find the SC variant via mapping
    const { data: mapping } = await service
      .from("channel_product_mappings")
      .select("variant_id, product_id")
      .eq("channel_id", channel.id)
      .eq("external_product_id", mlItemId ?? "")
      .maybeSingle()

    if (mapping?.variant_id) {
      // Upsert order item
      await service.from("order_items").upsert(
        {
          order_id: scOrder.id,
          variant_id: mapping.variant_id,
          quantity: qty,
          unit_price: item.unit_price ?? item.full_unit_price ?? 0,
        },
        { onConflict: "order_id,variant_id" },
      )

      // Deduct stock only when order is paid (avoid double deductions on updates)
      if (isPaid) {
        await service.rpc("decrement_variant_stock", {
          p_variant_id: mapping.variant_id,
          p_qty: qty,
        })
      }
    } else if (sku) {
      // Try finding by SKU as fallback
      const { data: variant } = await service
        .from("product_variants")
        .select("id")
        .eq("sku", sku)
        .maybeSingle()

      if (variant) {
        await service.from("order_items").upsert(
          {
            order_id: scOrder.id,
            variant_id: variant.id,
            quantity: qty,
            unit_price: item.unit_price ?? 0,
          },
          { onConflict: "order_id,variant_id" },
        )
        if (isPaid) {
          await service.rpc("decrement_variant_stock", {
            p_variant_id: variant.id,
            p_qty: qty,
          })
        }
      }
    }
  }

  void writeSyncLogWebhook(channel.id, {
    eventType: "webhook_order",
    status: "ok",
    summary: `Orden ML #${orderId} (${order.status}) procesada. Total: $${totalAmount}`,
    payload: { order_id: orderId, status: order.status, items: order.order_items?.length ?? 0 },
  })
}

async function handleItemNotification({
  channel,
  resource,
  service,
}: {
  channel: { id: string; tenant_id: string; metadata: unknown }
  resource: string
  service: ReturnType<typeof createServiceClient>
}) {
  // resource is like /items/MLA12345678
  const itemId = resource.split("/").pop()
  if (!itemId) return

  const item = await fetchMLItem(channel.id, itemId)

  // Find the SC product via mapping
  const { data: mapping } = await service
    .from("channel_product_mappings")
    .select("product_id, variant_id")
    .eq("channel_id", channel.id)
    .eq("external_product_id", itemId)
    .maybeSingle()

  if (!mapping?.product_id) {
    void writeSyncLogWebhook(channel.id, {
      eventType: "webhook_product",
      status: "skipped",
      summary: `Item ML ${itemId} no mapeado — ignorado`,
    })
    return
  }

  // Update SC product status
  const newStatus =
    item.status === "active" ? "active" : item.status === "paused" ? "draft" : "archived"

  await service
    .from("products")
    .update({ status: newStatus })
    .eq("id", mapping.product_id)

  // Update stock on the mapped variant
  if (mapping.variant_id) {
    const newStock =
      item.variations?.length > 0
        ? item.variations.reduce((s: number, v) => s + (v.available_quantity ?? 0), 0)
        : (item.available_quantity ?? 0)

    await service
      .from("product_variants")
      .update({ stock: newStock, price: item.price })
      .eq("id", mapping.variant_id)
  }

  void writeSyncLogWebhook(channel.id, {
    eventType: "webhook_product",
    status: "ok",
    summary: `Item ML ${itemId} actualizado: status=${item.status}, stock=${item.available_quantity}`,
    payload: { item_id: itemId, status: item.status },
  })
}
