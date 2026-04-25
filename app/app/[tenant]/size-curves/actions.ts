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

type SeedRow = {
  name: string
  slug: string
  kind: "size" | "color" | "material" | "other"
  description: string
  values: string[]
}

const DEFAULT_LISTS: SeedRow[] = [
  {
    name: "Adultos XS-XXL",
    slug: "adultos-xs-xxl",
    kind: "size",
    description: "Curva clásica de talles para indumentaria de adultos.",
    values: ["XS", "S", "M", "L", "XL", "XXL"],
  },
  {
    name: "Niños 1 a 12 años",
    slug: "ninos-1-12-anios",
    kind: "size",
    description: "Talles infantiles por rango de edad.",
    values: [
      "1-2 años",
      "2-3 años",
      "3-4 años",
      "4-5 años",
      "5-6 años",
      "6-7 años",
      "7-8 años",
      "8-9 años",
      "9-10 años",
      "10-11 años",
      "11-12 años",
    ],
  },
  {
    name: "Calzado adultos 36-45",
    slug: "calzado-adultos-36-45",
    kind: "size",
    description: "Numeración argentina de calzado adulto.",
    values: ["36", "37", "38", "39", "40", "41", "42", "43", "44", "45"],
  },
  {
    name: "Colores básicos",
    slug: "colores-basicos",
    kind: "color",
    description: "Paleta neutra para cualquier rubro.",
    values: ["Negro", "Blanco", "Gris", "Beige", "Marrón", "Azul", "Rojo", "Verde", "Amarillo", "Rosa"],
  },
  {
    name: "Materiales textiles",
    slug: "materiales-textiles",
    kind: "material",
    description: "Materiales más comunes en indumentaria.",
    values: ["Algodón", "Poliéster", "Lana", "Lino", "Seda", "Denim", "Cuero", "Sintético"],
  },
]

export async function seedDefaultLists(tenantSlug: string): Promise<{
  ok: boolean
  inserted?: number
  skipped?: number
  error?: string
}> {
  const { tenant } = await requireTenant(tenantSlug)
  const supabase = await createClient()

  // Read existing slugs to skip conflicts (we don't want to overwrite user edits).
  const { data: existing, error: readErr } = await supabase
    .from("size_curves")
    .select("slug")
    .eq("tenant_id", tenant.id)
  if (readErr) return { ok: false, error: readErr.message }

  const existingSlugs = new Set((existing ?? []).map((r) => r.slug))
  const rows = DEFAULT_LISTS.filter((d) => !existingSlugs.has(d.slug)).map((d) => ({
    tenant_id: tenant.id,
    name: d.name,
    slug: d.slug,
    kind: d.kind,
    description: d.description,
    values: d.values,
    is_system: false,
  }))

  if (rows.length === 0) {
    return { ok: true, inserted: 0, skipped: DEFAULT_LISTS.length }
  }

  const { error } = await supabase.from("size_curves").insert(rows)
  if (error) return { ok: false, error: error.message }

  revalidatePath(`/app/${tenantSlug}/size-curves`)
  revalidatePath(`/app/${tenantSlug}/product-types`)
  return {
    ok: true,
    inserted: rows.length,
    skipped: DEFAULT_LISTS.length - rows.length,
  }
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
