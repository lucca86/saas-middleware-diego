"use server"

import { z } from "zod"
import { createClient } from "@/lib/supabase/server"

const CreateTenantSchema = z.object({
  fullName: z.string().min(2).max(120),
  name: z.string().min(2).max(60),
  slug: z
    .string()
    .min(3)
    .max(40)
    .regex(/^[a-z0-9-]+$/, "Solo minúsculas, números y guiones"),
  businessType: z.string().min(2),
  currency: z.string().length(3).toUpperCase(),
})

export type CreateTenantResult =
  | { ok: true; slug: string; tenantId: string }
  | { ok: false; error: string }

const RESERVED_SLUGS = new Set([
  "admin",
  "api",
  "app",
  "auth",
  "dashboard",
  "help",
  "invitations",
  "login",
  "onboarding",
  "public",
  "select-tenant",
  "settings",
  "signup",
  "sign-up",
  "store",
  "support",
  "www",
])

export async function createTenantAction(
  input: z.input<typeof CreateTenantSchema>,
): Promise<CreateTenantResult> {
  const parsed = CreateTenantSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" }
  }

  const { fullName, name, slug, businessType, currency } = parsed.data

  if (RESERVED_SLUGS.has(slug)) {
    return { ok: false, error: "Ese identificador está reservado, elegí otro." }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { ok: false, error: "No autenticado" }

  // Sync profile name from wizard input
  await supabase
    .from("profiles")
    .upsert(
      { id: user.id, email: user.email ?? null, full_name: fullName },
      { onConflict: "id" },
    )

  const { data: tenant, error: tenantErr } = await supabase
    .from("tenants")
    .insert({
      name,
      slug,
      business_type: businessType,
      currency,
      created_by: user.id,
    })
    .select("id, slug")
    .single()

  if (tenantErr || !tenant) {
    if (tenantErr?.code === "23505") {
      return { ok: false, error: "Ese identificador ya está en uso." }
    }
    console.log("[v0] createTenant error:", tenantErr)
    return { ok: false, error: tenantErr?.message ?? "No pudimos crear el espacio" }
  }

  const { error: memberErr } = await supabase.from("tenant_members").insert({
    tenant_id: tenant.id,
    user_id: user.id,
    role: "owner",
  })

  if (memberErr) {
    await supabase.from("tenants").delete().eq("id", tenant.id)
    console.log("[v0] tenant_members insert error:", memberErr)
    return { ok: false, error: memberErr.message }
  }

  return { ok: true, slug: tenant.slug, tenantId: tenant.id }
}
