"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

const inviteSchema = z.object({
  tenantId: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(["admin", "operator", "viewer"]),
})

const updateRoleSchema = z.object({
  memberId: z.string().uuid(),
  tenantSlug: z.string(),
  role: z.enum(["admin", "operator", "viewer"]),
})

const removeMemberSchema = z.object({
  memberId: z.string().uuid(),
  tenantSlug: z.string(),
})

const revokeInvitationSchema = z.object({
  invitationId: z.string().uuid(),
  tenantSlug: z.string(),
})

export type ActionResult = { ok: true } | { ok: false; error: string }

export async function inviteMemberAction(
  input: z.input<typeof inviteSchema>,
): Promise<ActionResult> {
  const parsed = inviteSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" }
  }
  const { tenantId, email, role } = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "No autenticado" }

  // Check if email already corresponds to an existing member
  const { data: existingMember } = await supabase
    .from("tenant_members")
    .select("id, profiles!inner(email)")
    .eq("tenant_id", tenantId)
    .eq("profiles.email", email.toLowerCase())
    .maybeSingle()

  if (existingMember) {
    return { ok: false, error: "Ese email ya es miembro del espacio" }
  }

  const { data: tenant } = await supabase
    .from("tenants")
    .select("slug")
    .eq("id", tenantId)
    .maybeSingle()

  const { error } = await supabase.from("tenant_invitations").upsert(
    {
      tenant_id: tenantId,
      email: email.toLowerCase(),
      role,
      invited_by: user.id,
      expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      accepted_at: null,
      accepted_by: null,
    },
    { onConflict: "tenant_id,email" },
  )

  if (error) {
    console.log("[v0] invite insert error:", error)
    if (error.code === "42501") {
      return { ok: false, error: "No tenés permisos para invitar" }
    }
    return { ok: false, error: "No pudimos enviar la invitación" }
  }

  if (tenant?.slug) {
    revalidatePath(`/app/${tenant.slug}/settings/members`)
  }
  return { ok: true }
}

export async function updateMemberRoleAction(
  input: z.input<typeof updateRoleSchema>,
): Promise<ActionResult> {
  const parsed = updateRoleSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Datos inválidos" }
  const { memberId, tenantSlug, role } = parsed.data

  const supabase = await createClient()
  const { error } = await supabase
    .from("tenant_members")
    .update({ role })
    .eq("id", memberId)
    .neq("role", "owner")

  if (error) {
    console.log("[v0] update role error:", error)
    return { ok: false, error: "No pudimos actualizar el rol" }
  }

  revalidatePath(`/app/${tenantSlug}/settings/members`)
  return { ok: true }
}

export async function removeMemberAction(
  input: z.input<typeof removeMemberSchema>,
): Promise<ActionResult> {
  const parsed = removeMemberSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Datos inválidos" }
  const { memberId, tenantSlug } = parsed.data

  const supabase = await createClient()
  const { error } = await supabase
    .from("tenant_members")
    .delete()
    .eq("id", memberId)
    .neq("role", "owner")

  if (error) {
    console.log("[v0] remove member error:", error)
    return { ok: false, error: "No pudimos quitar al miembro" }
  }

  revalidatePath(`/app/${tenantSlug}/settings/members`)
  return { ok: true }
}

export async function revokeInvitationAction(
  input: z.input<typeof revokeInvitationSchema>,
): Promise<ActionResult> {
  const parsed = revokeInvitationSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Datos inválidos" }
  const { invitationId, tenantSlug } = parsed.data

  const supabase = await createClient()
  const { error } = await supabase
    .from("tenant_invitations")
    .delete()
    .eq("id", invitationId)

  if (error) {
    console.log("[v0] revoke invitation error:", error)
    return { ok: false, error: "No pudimos revocar la invitación" }
  }

  revalidatePath(`/app/${tenantSlug}/settings/members`)
  return { ok: true }
}
