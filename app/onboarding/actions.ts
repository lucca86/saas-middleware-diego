"use server"

import { z } from "zod"
import { createClient } from "@/lib/supabase/server"

const CreateTenantSchema = z.object({
  name: z.string().min(2).max(60),
  slug: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/, "Solo minúsculas, números y guiones"),
  businessType: z.enum(["retail", "wholesale", "manufacturer", "other"]),
  currency: z.string().length(3),
})

export type CreateTenantResult = { ok: true; slug: string } | { ok: false; error: string }

const RESERVED_SLUGS = new Set([
  "auth",
  "api",
  "app",
  "store",
  "onboarding",
  "select-tenant",
  "admin",
  "settings",
  "www",
  "help",
  "support",
])

export async function createTenantAction(input: z.input<typeof CreateTenantSchema>): Promise<CreateTenantResult> {
  const parsed = CreateTenantSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" }
  }

  const { name, slug, businessType, currency } = parsed.data

  if (RESERVED_SLUGS.has(slug)) {
    return { ok: false, error: "Ese identificador está reservado, elegí otro." }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, error: "No autenticado" }
  }

  // Insert tenant
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
    return { ok: false, error: tenantErr?.message ?? "No pudimos crear el espacio" }
  }

  // Insert ownership row
  const { error: memberErr } = await supabase.from("tenant_members").insert({
    tenant_id: tenant.id,
    user_id: user.id,
    role: "owner",
  })

  if (memberErr) {
    // Attempt rollback: delete the orphan tenant
    await supabase.from("tenants").delete().eq("id", tenant.id)
    return { ok: false, error: memberErr.message }
  }

  return { ok: true, slug: tenant.slug }
}
