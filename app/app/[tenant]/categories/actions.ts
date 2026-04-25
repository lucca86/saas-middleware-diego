"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { requireTenant } from "@/lib/tenant/context"
import { slugify } from "@/lib/products/slug"

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(2).max(60),
  slug: z.string().min(2).max(60).optional(),
  description: z.string().max(300).optional(),
  position: z.coerce.number().int().min(0).default(0),
})

export type CategoryFormState = { ok: boolean; error?: string }

export async function upsertCategory(
  tenantSlug: string,
  input: z.infer<typeof upsertSchema>,
): Promise<CategoryFormState> {
  const parsed = upsertSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" }
  }

  const { tenant } = await requireTenant(tenantSlug)
  const supabase = await createClient()
  const slug = parsed.data.slug?.trim() || slugify(parsed.data.name)

  if (parsed.data.id) {
    const { error } = await supabase
      .from("categories")
      .update({
        name: parsed.data.name,
        slug,
        description: parsed.data.description ?? null,
        position: parsed.data.position,
      })
      .eq("id", parsed.data.id)
      .eq("tenant_id", tenant.id)
    if (error) {
      if (error.code === "23505") return { ok: false, error: "Ya existe una categoría con ese identificador." }
      return { ok: false, error: error.message }
    }
  } else {
    const { error } = await supabase.from("categories").insert({
      tenant_id: tenant.id,
      name: parsed.data.name,
      slug,
      description: parsed.data.description ?? null,
      position: parsed.data.position,
    })
    if (error) {
      if (error.code === "23505") return { ok: false, error: "Ya existe una categoría con ese identificador." }
      return { ok: false, error: error.message }
    }
  }

  revalidatePath(`/app/${tenantSlug}/categories`)
  revalidatePath(`/app/${tenantSlug}/products`)
  return { ok: true }
}

export async function deleteCategory(tenantSlug: string, id: string): Promise<CategoryFormState> {
  const { tenant } = await requireTenant(tenantSlug)
  const supabase = await createClient()
  const { error } = await supabase.from("categories").delete().eq("id", id).eq("tenant_id", tenant.id)
  if (error) return { ok: false, error: error.message }

  revalidatePath(`/app/${tenantSlug}/categories`)
  revalidatePath(`/app/${tenantSlug}/products`)
  return { ok: true }
}
