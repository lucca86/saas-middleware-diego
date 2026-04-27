"use server"

import { revalidatePath } from "next/cache"
import { requirePlatformAdmin } from "@/lib/platform/auth"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"

const TENANT_ROLES = ["owner", "admin", "operator", "viewer"] as const
export type TenantRoleName = (typeof TENANT_ROLES)[number]

type Result = { ok: true; userId?: string; email?: string } | { ok: false; error: string }

/**
 * Slugify helper used on tenant creation. Lowercases, strips accents, replaces
 * non-alphanumerics with dashes, collapses repeats. Must match the URL shape
 * expected by `/app/[tenant]/...` routes.
 */
function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
}

/**
 * Platform-admin only: create a new tenant + assign an owner. We use the
 * service role so we can (a) bypass tenant RLS and (b) atomically insert
 * both the tenant and its initial membership without depending on the
 * caller already being a member. The chosen owner becomes the only person
 * with access until more memberships are added from /admin/users.
 */
export async function createTenant(input: {
  name: string
  slug?: string
  ownerUserId?: string
  businessType?: string
}): Promise<{ ok: true; slug: string } | { ok: false; error: string }> {
  await requirePlatformAdmin()

  const name = input.name.trim()
  if (name.length < 2) return { ok: false, error: "El nombre es muy corto" }

  const slug = (input.slug?.trim() ? slugify(input.slug) : slugify(name)) || ""
  if (slug.length < 2) return { ok: false, error: "Slug inválido" }

  const svc = createServiceClient()

  // Reject duplicate slugs explicitly so we can return a friendly error
  // instead of a generic 23505.
  const { data: existing } = await svc
    .from("tenants")
    .select("id")
    .eq("slug", slug)
    .maybeSingle()
  if (existing) return { ok: false, error: `El slug "${slug}" ya está en uso` }

  // Default the owner to the current platform admin if none is provided —
  // that way the tenant is reachable from the same session.
  let ownerId = input.ownerUserId
  if (!ownerId) {
    const userClient = await createClient()
    const { data } = await userClient.auth.getUser()
    ownerId = data.user?.id
  }
  if (!ownerId) return { ok: false, error: "No se pudo determinar el owner" }

  const { data: tenant, error: tErr } = await svc
    .from("tenants")
    .insert({
      slug,
      name,
      business_type: input.businessType ?? null,
      created_by: ownerId,
    })
    .select("id, slug")
    .single()
  if (tErr || !tenant) return { ok: false, error: tErr?.message ?? "No se pudo crear el tenant" }

  const { error: mErr } = await svc.from("tenant_members").insert({
    tenant_id: tenant.id,
    user_id: ownerId,
    role: "owner",
  })
  if (mErr) {
    // Roll back the tenant if we couldn't seed the owner — a tenant with
    // no members would be invisible to everyone.
    await svc.from("tenants").delete().eq("id", tenant.id)
    return { ok: false, error: `Tenant creado pero falló asignar owner: ${mErr.message}` }
  }

  revalidatePath("/admin")
  revalidatePath("/admin/tenants")
  return { ok: true, slug: tenant.slug }
}

export async function createTestUser(input: {
  email: string
  password: string
  fullName?: string
  tenantId?: string
  role?: TenantRoleName
  promoteToPlatformAdmin?: boolean
}): Promise<Result> {
  await requirePlatformAdmin()

  const email = input.email.trim().toLowerCase()
  const password = input.password
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: "Email inválido" }
  if (password.length < 8) return { ok: false, error: "La contraseña debe tener al menos 8 caracteres" }
  if (input.tenantId && !TENANT_ROLES.includes((input.role ?? "viewer") as TenantRoleName)) {
    return { ok: false, error: "Rol inválido" }
  }

  const supabase = createServiceClient()

  // 1. Create the auth user (email_confirm so they can log in immediately).
  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: input.fullName ? { full_name: input.fullName } : undefined,
  })
  if (createErr || !created?.user) {
    return { ok: false, error: createErr?.message ?? "No se pudo crear el usuario" }
  }
  const userId = created.user.id

  // 2. Optionally attach to a tenant.
  if (input.tenantId) {
    const role = (input.role ?? "viewer") as TenantRoleName
    const { error: memErr } = await supabase
      .from("tenant_members")
      .insert({ user_id: userId, tenant_id: input.tenantId, role })
    if (memErr) {
      // best-effort cleanup
      await supabase.auth.admin.deleteUser(userId)
      return { ok: false, error: `Usuario creado pero falló asignación: ${memErr.message}` }
    }
  }

  // 3. Optionally promote to platform admin.
  if (input.promoteToPlatformAdmin) {
    const { error: paErr } = await supabase
      .from("platform_admins")
      .insert({ user_id: userId, notes: "Creado desde panel de admin" })
    if (paErr) return { ok: false, error: `Usuario creado, falló promoción: ${paErr.message}` }
  }

  revalidatePath("/admin/users")
  revalidatePath("/admin")
  return { ok: true, userId, email }
}

export async function togglePlatformAdmin(userId: string, makeAdmin: boolean): Promise<Result> {
  await requirePlatformAdmin()
  const supabase = createServiceClient()

  if (makeAdmin) {
    const { error } = await supabase
      .from("platform_admins")
      .insert({ user_id: userId, notes: "Promoted via /admin" })
    if (error && !error.message.includes("duplicate")) return { ok: false, error: error.message }
  } else {
    const { error } = await supabase.from("platform_admins").delete().eq("user_id", userId)
    if (error) return { ok: false, error: error.message }
  }

  revalidatePath("/admin/users")
  return { ok: true }
}

export async function removeTenantMembership(userId: string, tenantId: string): Promise<Result> {
  await requirePlatformAdmin()
  const supabase = createServiceClient()
  const { error } = await supabase
    .from("tenant_members")
    .delete()
    .eq("user_id", userId)
    .eq("tenant_id", tenantId)
  if (error) return { ok: false, error: error.message }
  revalidatePath("/admin/users")
  revalidatePath("/admin/tenants")
  return { ok: true }
}

export async function addTenantMembership(input: {
  userId: string
  tenantId: string
  role: TenantRoleName
}): Promise<Result> {
  await requirePlatformAdmin()
  if (!TENANT_ROLES.includes(input.role)) return { ok: false, error: "Rol inválido" }
  const supabase = createServiceClient()
  const { error } = await supabase
    .from("tenant_members")
    .upsert(
      { user_id: input.userId, tenant_id: input.tenantId, role: input.role },
      { onConflict: "user_id,tenant_id" },
    )
  if (error) return { ok: false, error: error.message }
  revalidatePath("/admin/users")
  return { ok: true }
}

export async function deleteUser(userId: string): Promise<Result> {
  await requirePlatformAdmin()
  const supabase = createServiceClient()
  const { error } = await supabase.auth.admin.deleteUser(userId)
  if (error) return { ok: false, error: error.message }
  revalidatePath("/admin/users")
  return { ok: true }
}
