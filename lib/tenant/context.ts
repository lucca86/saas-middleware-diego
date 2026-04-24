import "server-only"
import { cache } from "react"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export type TenantRole = "owner" | "admin" | "operator" | "viewer"

export interface TenantContext {
  id: string
  slug: string
  name: string
  role: TenantRole
  currency: string
  timezone: string
  plan: string
}

/**
 * Resolve the current tenant for a path-based route (/app/[tenant]/...)
 * and verify that the authenticated user is a member.
 *
 * Cached per-request via React cache() so RSCs inside the same layout tree
 * reuse the same DB query.
 *
 * Redirects:
 *   - unauthenticated users -> /auth/login
 *   - non-members           -> /select-tenant?denied={slug}
 */
export const requireTenant = cache(async (slug: string): Promise<TenantContext> => {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/auth/login?next=/app/${slug}`)
  }

  const { data, error } = await supabase
    .from("tenant_members")
    .select("role, tenants!inner(id, slug, name, currency, timezone, plan)")
    .eq("tenants.slug", slug)
    .eq("user_id", user.id)
    .maybeSingle()

  if (error || !data) {
    redirect(`/select-tenant?denied=${slug}`)
  }

  // supabase-js types the joined table as array; narrow it
  const tenant = Array.isArray(data.tenants) ? data.tenants[0] : data.tenants

  return {
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    role: data.role as TenantRole,
    currency: tenant.currency,
    timezone: tenant.timezone,
    plan: tenant.plan,
  }
})

/**
 * List all tenants the current user is a member of. Used by /select-tenant.
 */
export const listUserTenants = cache(async () => {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  const { data } = await supabase
    .from("tenant_members")
    .select("role, tenant:tenants!inner(id, slug, name, plan)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  return (data ?? []).map((m) => {
    const tenant = Array.isArray(m.tenant) ? m.tenant[0] : m.tenant
    return {
      ...tenant,
      role: m.role as TenantRole,
    }
  })
})
