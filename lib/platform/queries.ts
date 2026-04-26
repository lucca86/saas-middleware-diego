import "server-only"
import { createServiceClient } from "@/lib/supabase/service"

export type PlatformTenant = {
  id: string
  slug: string
  name: string
  is_storefront_published: boolean
  created_at: string
  member_count: number
  product_count: number
}

export type PlatformUser = {
  id: string
  email: string | null
  created_at: string
  last_sign_in_at: string | null
  is_platform_admin: boolean
  memberships: Array<{ tenant_id: string; tenant_slug: string; tenant_name: string; role: string }>
}

export async function listAllTenants(): Promise<PlatformTenant[]> {
  const supabase = createServiceClient()
  const { data: tenants } = await supabase
    .from("tenants")
    .select("id, slug, name, is_storefront_published, created_at")
    .order("created_at", { ascending: false })

  if (!tenants) return []

  // Counts per tenant in two compact queries.
  const ids = tenants.map((t) => t.id)
  const [{ data: members }, { data: products }] = await Promise.all([
    supabase.from("tenant_members").select("tenant_id").in("tenant_id", ids),
    supabase.from("products").select("tenant_id").in("tenant_id", ids),
  ])

  const memberCount = new Map<string, number>()
  for (const m of members ?? []) memberCount.set(m.tenant_id, (memberCount.get(m.tenant_id) ?? 0) + 1)

  const productCount = new Map<string, number>()
  for (const p of products ?? []) productCount.set(p.tenant_id, (productCount.get(p.tenant_id) ?? 0) + 1)

  return tenants.map((t) => ({
    ...t,
    member_count: memberCount.get(t.id) ?? 0,
    product_count: productCount.get(t.id) ?? 0,
  }))
}

export async function listAllUsers(): Promise<PlatformUser[]> {
  const supabase = createServiceClient()

  const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 })
  const users = list?.users ?? []
  if (users.length === 0) return []

  const userIds = users.map((u) => u.id)

  const [{ data: members }, { data: admins }, { data: tenants }] = await Promise.all([
    supabase.from("tenant_members").select("user_id, tenant_id, role").in("user_id", userIds),
    supabase.from("platform_admins").select("user_id").in("user_id", userIds),
    supabase.from("tenants").select("id, slug, name"),
  ])

  const tenantById = new Map((tenants ?? []).map((t) => [t.id, t]))
  const adminSet = new Set((admins ?? []).map((a) => a.user_id))

  const membershipsByUser = new Map<string, PlatformUser["memberships"]>()
  for (const m of members ?? []) {
    const t = tenantById.get(m.tenant_id)
    if (!t) continue
    const arr = membershipsByUser.get(m.user_id) ?? []
    arr.push({ tenant_id: t.id, tenant_slug: t.slug, tenant_name: t.name, role: m.role })
    membershipsByUser.set(m.user_id, arr)
  }

  return users
    .map((u) => ({
      id: u.id,
      email: u.email ?? null,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
      is_platform_admin: adminSet.has(u.id),
      memberships: membershipsByUser.get(u.id) ?? [],
    }))
    .sort((a, b) => (a.email ?? "").localeCompare(b.email ?? ""))
}

export async function platformStats() {
  const supabase = createServiceClient()
  const [{ count: tenants }, { count: products }, { count: variants }] = await Promise.all([
    supabase.from("tenants").select("id", { count: "exact", head: true }),
    supabase.from("products").select("id", { count: "exact", head: true }),
    supabase.from("product_variants").select("id", { count: "exact", head: true }),
  ])
  const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 })
  return {
    tenants: tenants ?? 0,
    products: products ?? 0,
    variants: variants ?? 0,
    users: list?.total ?? 0,
  }
}
