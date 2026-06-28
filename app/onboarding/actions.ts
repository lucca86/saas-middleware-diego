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

  const { data, error: rpcErr } = await supabase
    .rpc("create_tenant_with_owner", {
      p_name: name,
      p_slug: slug,
      p_business_type: businessType,
      p_currency: currency,
    })
    .single<{ id: string; slug: string }>()

  if (rpcErr || !data) {
    if (rpcErr?.code === "23505" || /already taken/i.test(rpcErr?.message ?? "")) {
      return { ok: false, error: "Ese identificador ya está en uso." }
    }
    if (rpcErr?.code === "42501") {
      return { ok: false, error: "Tu sesión expiró. Iniciá sesión nuevamente." }
    }
    console.log("[sc] create_tenant_with_owner error:", rpcErr)
    return { ok: false, error: rpcErr?.message ?? "No pudimos crear el espacio" }
  }

  return { ok: true, slug: data.slug, tenantId: data.id }
}
