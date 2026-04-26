"use server"

import { revalidatePath } from "next/cache"
import { requirePlatformAdmin } from "@/lib/platform/auth"
import { createServiceClient } from "@/lib/supabase/service"

const TENANT_ROLES = ["owner", "admin", "operator", "viewer"] as const
export type TenantRoleName = (typeof TENANT_ROLES)[number]

type Result = { ok: true; userId?: string; email?: string } | { ok: false; error: string }

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
