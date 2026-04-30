import "server-only"
import { createClient } from "@/lib/supabase/server"
import type { Order, OrderItem, OrderWithItems, OrderStatus } from "./types"

export async function listTenantOrders(
  tenantId: string,
  filter?: { status?: OrderStatus },
): Promise<Order[]> {
  const supabase = await createClient()
  let q = supabase
    .from("orders")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(200)
  if (filter?.status) q = q.eq("status", filter.status)
  const { data, error } = await q
  if (error) throw error
  return ((data ?? []) as unknown as Order[])
}

export async function getOrderByCode(
  tenantId: string,
  code: string,
): Promise<OrderWithItems | null> {
  const supabase = await createClient()
  const { data: order, error } = await supabase
    .from("orders")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("code", code)
    .maybeSingle()
  if (error || !order) return null

  const { data: items } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", order.id)
    .order("created_at", { ascending: true })

  return { ...(order as unknown as Order), items: (items ?? []) as unknown as OrderItem[] }
}

/** Public lookup of a single order by code (storefront success page). */
export async function getPublicOrderByCode(
  tenantSlug: string,
  code: string,
): Promise<OrderWithItems | null> {
  // We need to bypass RLS for the success page (anon user just placed it).
  // To keep things simple we use the service client; abuse is mitigated by
  // the unguessable nature of the code combined with email verification
  // in a future iteration.
  const { createServiceClient } = await import("@/lib/supabase/service")
  const supabase = createServiceClient()

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, is_storefront_published")
    .eq("slug", tenantSlug)
    .maybeSingle()
  if (!tenant?.is_storefront_published) return null

  const { data: order } = await supabase
    .from("orders")
    .select("*")
    .eq("tenant_id", tenant.id)
    .eq("code", code)
    .maybeSingle()
  if (!order) return null
  const { data: items } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", order.id)
  return { ...(order as unknown as Order), items: (items ?? []) as unknown as OrderItem[] }
}

export async function countTenantOrdersByStatus(
  tenantId: string,
): Promise<Record<OrderStatus, number>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("orders")
    .select("status")
    .eq("tenant_id", tenantId)
  if (error) throw error
  const counts: Record<OrderStatus, number> = {
    pending: 0,
    confirmed: 0,
    fulfilled: 0,
    cancelled: 0,
  }
  for (const row of (data ?? []) as Array<{ status: OrderStatus }>) {
    counts[row.status] = (counts[row.status] ?? 0) + 1
  }
  return counts
}
