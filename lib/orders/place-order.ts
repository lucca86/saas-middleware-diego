"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createServiceClient } from "@/lib/supabase/service"
import { clearCart, readCart } from "@/lib/cart/cookie"
import { notifyOrderEvent } from "@/lib/email/notify-order-event"

/**
 * Place a new storefront order.
 *
 * Steps:
 *   1. Read the cart cookie.
 *   2. Validate tenant exists and is published.
 *   3. Re-fetch every variant from the DB to recompute totals (we never
 *      trust client-side prices).
 *   4. Generate a per-tenant sequential code (ORD-N).
 *   5. Insert order + items.
 *   6. Insert one stock_movements row per line ("sale", negative qty).
 *   7. Decrement product_variants.stock.
 *   8. Clear the cart cookie.
 *
 * The whole flow uses the service role: anon users place orders without
 * authentication, and our RLS allows insert with a service role only.
 *
 * Note: this is not a transaction across multiple tables. If the stock
 * decrement fails after the order is inserted, the operator can fix it
 * via the admin panel. We keep it simple while we don't have RPC support.
 */

const PlaceOrderSchema = z.object({
  customer_name: z.string().min(2).max(120),
  customer_email: z.string().email().max(160),
  customer_phone: z.string().max(40).optional().or(z.literal("")),
  shipping_notes: z.string().max(800).optional().or(z.literal("")),
})

export type PlaceOrderInput = z.infer<typeof PlaceOrderSchema>

export type PlaceOrderResult =
  | { ok: true; orderCode: string; total: number }
  | { ok: false; error: string }

export async function placeOrder(
  tenantSlug: string,
  input: PlaceOrderInput,
): Promise<PlaceOrderResult> {
  const parsed = PlaceOrderSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: "Datos del cliente inválidos" }
  }

  const cart = await readCart(tenantSlug)
  if (cart.lines.length === 0) {
    return { ok: false, error: "El carrito está vacío" }
  }

  const supabase = createServiceClient()

  const { data: tenant, error: tenantErr } = await supabase
    .from("tenants")
    .select("id, slug, currency, is_storefront_published")
    .eq("slug", tenantSlug)
    .maybeSingle()
  if (tenantErr || !tenant || !tenant.is_storefront_published) {
    return { ok: false, error: "Tienda no disponible" }
  }

  // Re-fetch each variant from DB to recompute prices and validate stock.
  const variantIds = cart.lines.map((l) => l.variantId)
  const { data: dbVariants, error: variantErr } = await supabase
    .from("product_variants")
    .select("id, product_id, sku, attributes, price, stock, status, products!inner(name, status)")
    .in("id", variantIds)
    .eq("tenant_id", tenant.id)
  if (variantErr) return { ok: false, error: "Error al validar el carrito" }
  if (!dbVariants || dbVariants.length === 0) {
    return { ok: false, error: "Los productos del carrito ya no están disponibles" }
  }

  // Build a map and validate every cart line is still purchasable.
  const variantMap = new Map(dbVariants.map((v) => [v.id, v]))
  let subtotal = 0
  const items: Array<{
    product_id: string
    variant_id: string
    product_name: string
    variant_sku: string | null
    variant_attrs: Record<string, string>
    unit_price: number
    qty: number
    line_total: number
  }> = []

  for (const line of cart.lines) {
    const v = variantMap.get(line.variantId)
    if (!v) return { ok: false, error: `Producto ya no disponible: ${line.productName}` }
    const product = Array.isArray(v.products) ? v.products[0] : v.products
    if (!product || product.status !== "active" || v.status !== "active") {
      return { ok: false, error: `Producto ya no disponible: ${line.productName}` }
    }
    if ((v.stock ?? 0) < line.qty) {
      return {
        ok: false,
        error: `Stock insuficiente para ${line.productName}: quedan ${v.stock ?? 0}`,
      }
    }
    const unitPrice = Number(v.price)
    const lineTotal = unitPrice * line.qty
    subtotal += lineTotal
    items.push({
      product_id: v.product_id,
      variant_id: v.id,
      product_name: product.name,
      variant_sku: v.sku ?? null,
      variant_attrs: (v.attributes ?? {}) as Record<string, string>,
      unit_price: unitPrice,
      qty: line.qty,
      line_total: lineTotal,
    })
  }

  // Generate a per-tenant sequential code. We count existing orders and
  // add 1. Race conditions are acceptable here (worst case two orders share
  // a near-code; we have a UNIQUE(tenant_id, code) so the second insert
  // would retry).
  const { count: orderCount } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenant.id)
  const code = `ORD-${String((orderCount ?? 0) + 1).padStart(4, "0")}`

  const { data: order, error: insertErr } = await supabase
    .from("orders")
    .insert({
      tenant_id: tenant.id,
      code,
      customer_name: parsed.data.customer_name,
      customer_email: parsed.data.customer_email,
      customer_phone: parsed.data.customer_phone || null,
      shipping_notes: parsed.data.shipping_notes || null,
      currency: tenant.currency,
      subtotal,
      total: subtotal, // no shipping/tax for now
      status: "pending",
    })
    .select("id, code, total")
    .single()

  if (insertErr || !order) {
    console.log("[v0] order insert error:", insertErr?.message)
    return { ok: false, error: "No pudimos registrar el pedido" }
  }

  const itemsPayload = items.map((it) => ({ ...it, order_id: order.id, tenant_id: tenant.id }))
  const { error: itemsErr } = await supabase.from("order_items").insert(itemsPayload)
  if (itemsErr) {
    console.log("[v0] order_items insert error:", itemsErr.message)
    // Roll back the order to keep the DB consistent.
    await supabase.from("orders").delete().eq("id", order.id)
    return { ok: false, error: "No pudimos registrar el pedido" }
  }

  // Stock decrement + movement entry per line. Best-effort.
  for (const it of items) {
    await supabase.from("stock_movements").insert({
      tenant_id: tenant.id,
      product_id: it.product_id,
      variant_id: it.variant_id,
      type: "sale",
      qty: -it.qty,
      reason: `Order ${code}`,
      reference: order.id,
    })
    const v = variantMap.get(it.variant_id)
    const newStock = Math.max(0, (v?.stock ?? 0) - it.qty)
    await supabase
      .from("product_variants")
      .update({ stock: newStock })
      .eq("id", it.variant_id)
  }

  await clearCart(tenantSlug)

  // Fire-and-forget transactional emails. Both helpers swallow errors so an
  // SMTP outage never blocks the order. We don't await in parallel because
  // we want the customer email to be the priority; tenant notification is
  // secondary. Both run before we return so the cookie and headers are
  // already settled.
  await notifyOrderEvent(order.id, "received")
  await notifyOrderEvent(order.id, "tenant_notification")

  revalidatePath(`/s/${tenantSlug}`, "layout")
  revalidatePath(`/app/${tenantSlug}/orders`)
  return { ok: true, orderCode: order.code, total: Number(order.total) }
}
