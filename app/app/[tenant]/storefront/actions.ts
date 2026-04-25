"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requireTenant } from "@/lib/tenant/context"
import { createClient } from "@/lib/supabase/server"

const configSchema = z.object({
  hero_title: z.string().max(120).optional(),
  hero_subtitle: z.string().max(240).optional(),
  about: z.string().max(1200).optional(),
  whatsapp: z
    .string()
    .max(24)
    .regex(/^[+\d\s()-]*$/, "Solo dígitos, espacios, paréntesis y guiones")
    .optional()
    .or(z.literal("")),
  whatsapp_template: z.string().max(400).optional(),
  instagram: z
    .string()
    .max(40)
    .regex(/^[a-zA-Z0-9._]*$/, "Solo letras, números, puntos y guion bajo")
    .optional()
    .or(z.literal("")),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  accent: z
    .string()
    .max(7)
    .regex(/^(#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}))?$/, "Color hex inválido (#0aF o #00aaff)")
    .optional()
    .or(z.literal("")),
  hide_out_of_stock: z.boolean().optional(),
  hide_prices: z.boolean().optional(),
})

export type StorefrontFormState =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string> }

export async function saveStorefrontConfig(
  tenantSlug: string,
  raw: unknown,
): Promise<StorefrontFormState> {
  const { tenant, role } = await requireTenant(tenantSlug)
  if (role !== "owner" && role !== "admin") {
    return { ok: false, error: "No tenés permiso para editar el storefront." }
  }

  const parsed = configSchema.safeParse(raw)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".") || "form"
      fieldErrors[path] = issue.message
    }
    return { ok: false, error: "Hay campos inválidos.", fieldErrors }
  }

  // Clean empties so we don't save "" everywhere.
  const cleaned: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v === "" || v === undefined) continue
    cleaned[k] = v
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from("tenants")
    .update({ storefront_config: cleaned })
    .eq("id", tenant.id)

  if (error) return { ok: false, error: error.message }

  revalidatePath(`/app/${tenantSlug}/storefront`)
  revalidatePath(`/s/${tenantSlug}`, "layout")
  return { ok: true }
}

export async function setStorefrontPublished(
  tenantSlug: string,
  published: boolean,
): Promise<StorefrontFormState> {
  const { tenant, role } = await requireTenant(tenantSlug)
  if (role !== "owner" && role !== "admin") {
    return { ok: false, error: "Solo owners o admins pueden publicar el storefront." }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from("tenants")
    .update({ is_storefront_published: published })
    .eq("id", tenant.id)

  if (error) return { ok: false, error: error.message }

  revalidatePath(`/app/${tenantSlug}/storefront`)
  revalidatePath(`/s/${tenantSlug}`, "layout")
  return { ok: true }
}
