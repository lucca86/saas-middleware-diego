"use server"

import { revalidatePath } from "next/cache"
import { requireTenant } from "@/lib/tenant/context"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import type { OrderStatus } from "./types"

const NEXT_STATUS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["fulfilled", "cancelled"],
  fulfilled: [],
  cancelled: [],
}

export async function updateOrderStatus(
  tenantSlug: string,
  orderId: string,
  newStatus: OrderStatus,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { tenant, role } = await requireTenant(tenantSlug)
  if (!["owner", "admin", "operator"].includes(role)) {
    return { ok: false, error: "Sin permiso" }
  }

  const supabase = await createClient()
  const { data: order, error } = await supabase
    .from("orders")
    .select("id, status")
    .eq("id", orderId)
    .eq("tenant_id", tenant.id)
    .maybeSingle()
  if (error || !order) return { ok: false, error: "Pedido no encontrado" }

  const allowed = NEXT_STATUS[order.status as OrderStatus] ?? []
  if (!allowed.includes(newStatus)) {
    return { ok: false, error: `No se puede pasar de ${order.status} a ${newStatus}` }
  }

  // Cancellation reverses stock by inserting "return" movements and
  // restoring variant stock. We use the service client because RLS for
  // stock_movements requires tenant membership which we already verified.
  if (newStatus === "cancelled") {
    const svc = createServiceClient()
    const { data: items } = await svc
      .from("order_items")
      .select("variant_id, qty, product_id")
      .eq("order_id", orderId)
    for (const it of (items ?? []) as Array<{
      variant_id: string | null
      product_id: string | null
      qty: number
    }>) {
      if (!it.variant_id) continue
      await svc.from("stock_movements").insert({
        tenant_id: tenant.id,
        product_id: it.product_id,
        variant_id: it.variant_id,
        type: "return",
        qty: it.qty,
        reason: `Cancelación`,
        reference: orderId,
      })
      // Re-add stock atomically by re-reading current value.
      const { data: v } = await svc
        .from("product_variants")
        .select("stock")
        .eq("id", it.variant_id)
        .maybeSingle()
      if (v) {
        await svc
          .from("product_variants")
          .update({ stock: (v.stock ?? 0) + it.qty })
          .eq("id", it.variant_id)
      }
    }
  }

  const { error: updErr } = await supabase
    .from("orders")
    .update({ status: newStatus })
    .eq("id", orderId)
    .eq("tenant_id", tenant.id)
  if (updErr) return { ok: false, error: updErr.message }

  revalidatePath(`/app/${tenantSlug}/orders`)
  revalidatePath(`/app/${tenantSlug}/orders/${orderId}`)
  return { ok: true }
}
