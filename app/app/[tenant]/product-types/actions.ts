"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { requireTenant } from "@/lib/tenant/context"
import { slugify } from "@/lib/products/slug"

const attributeSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(40)
    .regex(/^[a-z][a-z0-9_]*$/, "Solo minúsculas, números y guion bajo"),
  label: z.string().min(1).max(80),
  type: z.enum(["text", "number", "select"]),
  options: z.array(z.string().min(1).max(80)).optional(),
  is_variant: z.boolean(),
  required: z.boolean().optional(),
  help: z.string().max(200).optional(),
})

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(2).max(60),
  slug: z.string().min(2).max(40).optional(),
  icon: z.string().max(40).optional(),
  description: z.string().max(400).optional(),
  attributes: z.array(attributeSchema).max(20),
})

export type ProductTypeFormState = {
  ok: boolean
  error?: string
  fieldErrors?: Record<string, string>
}

export async function upsertProductType(
  tenantSlug: string,
  input: z.infer<typeof upsertSchema>,
): Promise<ProductTypeFormState> {
  const parsed = upsertSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: "Datos inválidos", fieldErrors: parsed.error.flatten().fieldErrors as never }
  }

  // Validate variant attrs have at least one option
  for (const a of parsed.data.attributes) {
    if (a.is_variant && (a.type !== "select" || !a.options || a.options.length === 0)) {
      return {
        ok: false,
        error: `El atributo "${a.label}" se usa como variante pero no tiene opciones definidas.`,
      }
    }
  }

  const { tenant } = await requireTenant(tenantSlug)
  const supabase = await createClient()

  const slug = parsed.data.slug?.trim() || slugify(parsed.data.name)

  if (parsed.data.id) {
    const { error } = await supabase
      .from("product_types")
      .update({
        name: parsed.data.name,
        slug,
        icon: parsed.data.icon ?? null,
        description: parsed.data.description ?? null,
        attributes: parsed.data.attributes,
      })
      .eq("id", parsed.data.id)
      .eq("tenant_id", tenant.id)

    if (error) return { ok: false, error: error.message }
  } else {
    const { error } = await supabase.from("product_types").insert({
      tenant_id: tenant.id,
      name: parsed.data.name,
      slug,
      icon: parsed.data.icon ?? null,
      description: parsed.data.description ?? null,
      attributes: parsed.data.attributes,
      is_system: false,
    })

    if (error) {
      if (error.code === "23505") return { ok: false, error: "Ya existe un tipo con ese identificador." }
      return { ok: false, error: error.message }
    }
  }

  revalidatePath(`/app/${tenantSlug}/product-types`)
  return { ok: true }
}

export async function deleteProductType(tenantSlug: string, id: string): Promise<ProductTypeFormState> {
  const { tenant } = await requireTenant(tenantSlug)
  const supabase = await createClient()

  const { error } = await supabase
    .from("product_types")
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenant.id)
    .eq("is_system", false)

  if (error) return { ok: false, error: error.message }

  revalidatePath(`/app/${tenantSlug}/product-types`)
  return { ok: true }
}
