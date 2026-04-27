import "server-only"
import { cache } from "react"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export type TenantRole = "owner" | "admin" | "operator" | "viewer"

export interface Tenant {
  id: string
  slug: string
  name: string
  business_type: string | null
  currency: string
  timezone: string
  plan: string
}

export interface TenantContext {
  tenant: Tenant
  role: TenantRole
}

/**
 * Resolve the current tenant for a path-based route (/app/[tenant]/...)
 * and verify that the authenticated user is a member.
 *
 * Cached per-request via React cache() so RSCs inside the same layout tree
 * reuse the same DB query.
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
    .select(
      "role, tenants!inner(id, slug, name, business_type, currency, timezone, plan)",
    )
    .eq("tenants.slug", slug)
    .eq("user_id", user.id)
    .maybeSingle()

  if (error || !data) {
    // Don't echo the slug back: the user just tried to reach a tenant they
    // don't belong to, and exposing arbitrary slugs would leak info about
    // other tenants. A generic flag is enough for the UI.
    redirect(`/select-tenant?denied=1`)
  }

  const t = Array.isArray(data.tenants) ? data.tenants[0] : data.tenants

  return {
    tenant: {
      id: t.id,
      slug: t.slug,
      name: t.name,
      business_type: t.business_type,
      currency: t.currency,
      timezone: t.timezone,
      plan: t.plan,
    },
    role: data.role as TenantRole,
  }
})

/**
 * List all tenants the current user is a member of. Used by /select-tenant
 * and the tenant switcher popover.
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

export const getCurrentUserProfile = cache(async () => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, avatar_url")
    .eq("id", user.id)
    .maybeSingle()

  return {
    id: user.id,
    email: user.email ?? profile?.email ?? null,
    full_name: profile?.full_name ?? null,
    avatar_url: profile?.avatar_url ?? null,
  }
})
