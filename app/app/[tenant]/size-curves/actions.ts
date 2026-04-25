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
  kind: z.enum(["size", "color", "material", "other"]).default("size"),
  description: z.string().max(300).optional(),
  values: z
    .array(z.string().min(1).max(40))
    .min(1, "Agregá al menos un valor")
    .max(60, "Demasiados valores"),
})

export type SizeCurveFormState = { ok: boolean; error?: string }

export async function upsertSizeCurve(
  tenantSlug: string,
  input: z.infer<typeof upsertSchema>,
): Promise<SizeCurveFormState> {
  const parsed = upsertSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" }
  }

  const { tenant } = await requireTenant(tenantSlug)
  const supabase = await createClient()
  const slug = parsed.data.slug?.trim() || slugify(parsed.data.name)
  // dedupe values preserving order
  const seen = new Set<string>()
  const values = parsed.data.values.filter((v) => {
    const t = v.trim()
    if (!t || seen.has(t)) return false
    seen.add(t)
    return true
  })

  if (parsed.data.id) {
    const { error } = await supabase
      .from("size_curves")
      .update({
        name: parsed.data.name,
        slug,
        kind: parsed.data.kind,
        description: parsed.data.description ?? null,
        values,
      })
      .eq("id", parsed.data.id)
      .eq("tenant_id", tenant.id)
    if (error) {
      if (error.code === "23505") return { ok: false, error: "Ya existe una curva con ese identificador." }
      return { ok: false, error: error.message }
    }
  } else {
    const { error } = await supabase.from("size_curves").insert({
      tenant_id: tenant.id,
      name: parsed.data.name,
      slug,
      kind: parsed.data.kind,
      description: parsed.data.description ?? null,
      values,
      is_system: false,
    })
    if (error) {
      if (error.code === "23505") return { ok: false, error: "Ya existe una curva con ese identificador." }
      return { ok: false, error: error.message }
    }
  }

  revalidatePath(`/app/${tenantSlug}/size-curves`)
  revalidatePath(`/app/${tenantSlug}/product-types`)
  return { ok: true }
}

export async function deleteSizeCurve(tenantSlug: string, id: string): Promise<SizeCurveFormState> {
  const { tenant } = await requireTenant(tenantSlug)
  const supabase = await createClient()
  const { error } = await supabase
    .from("size_curves")
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenant.id)
    .eq("is_system", false)
  if (error) return { ok: false, error: error.message }

  revalidatePath(`/app/${tenantSlug}/size-curves`)
  return { ok: true }
}
