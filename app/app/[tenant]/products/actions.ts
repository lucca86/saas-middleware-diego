"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { requireTenant } from "@/lib/tenant/context"
import { slugify } from "@/lib/products/slug"
import { variantKey } from "@/lib/products/cartesian"

const variantInputSchema = z.object({
  id: z.string().uuid().optional(),
  attributes: z.record(z.string(), z.string()).default({}),
  sku: z.string().max(60).optional().nullable(),
  barcode: z.string().max(60).optional().nullable(),
  price: z.coerce.number().min(0).default(0),
  compare_at_price: z.coerce.number().min(0).optional().nullable(),
  cost: z.coerce.number().min(0).optional().nullable(),
  stock: z.coerce.number().int().min(0).default(0),
  status: z.enum(["active", "archived"]).default("active"),
})

const productInputSchema = z.object({
  id: z.string().uuid().optional(),
  type_id: z.string().uuid().nullable(),
  name: z.string().min(2).max(120),
  slug: z.string().max(120).optional().nullable(),
  sku: z.string().max(60).optional().nullable(),
  description: z.string().max(4000).optional().nullable(),
  status: z.enum(["draft", "active", "archived"]).default("draft"),
  category: z.string().max(60).optional().nullable(),
  tags: z.array(z.string().max(40)).max(20).default([]),
  attributes: z.record(z.string(), z.unknown()).default({}),
  variants: z.array(variantInputSchema).max(500),
})

export type ProductFormState = { ok: boolean; error?: string; productId?: string }

export async function saveProduct(
  tenantSlug: string,
  input: z.infer<typeof productInputSchema>,
): Promise<ProductFormState> {
  const parsed = productInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" }
  }

  const { tenant } = await requireTenant(tenantSlug)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "No autenticado" }

  const data = parsed.data
  const slug = (data.slug?.trim() || slugify(data.name)).slice(0, 120) || slugify(data.name + "-" + Date.now())

  let productId = data.id

  if (!productId) {
    const { data: created, error } = await supabase
      .from("products")
      .insert({
        tenant_id: tenant.id,
        type_id: data.type_id,
        name: data.name,
        slug,
        sku: data.sku || null,
        description: data.description || null,
        status: data.status,
        category: data.category || null,
        tags: data.tags,
        attributes: data.attributes,
        created_by: user.id,
      })
      .select("id")
      .single()

    if (error) {
      if (error.code === "23505")
        return { ok: false, error: "Ya hay un producto con ese SKU o slug en este espacio." }
      return { ok: false, error: error.message }
    }
    productId = created.id
  } else {
    const { error } = await supabase
      .from("products")
      .update({
        type_id: data.type_id,
        name: data.name,
        slug,
        sku: data.sku || null,
        description: data.description || null,
        status: data.status,
        category: data.category || null,
        tags: data.tags,
        attributes: data.attributes,
      })
      .eq("id", productId)
      .eq("tenant_id", tenant.id)

    if (error) {
      if (error.code === "23505")
        return { ok: false, error: "Ya hay un producto con ese SKU o slug en este espacio." }
      return { ok: false, error: error.message }
    }
  }

  // ----- Sync variants -----
  // Read existing
  const { data: existing } = await supabase
    .from("product_variants")
    .select("id, attributes")
    .eq("tenant_id", tenant.id)
    .eq("product_id", productId)

  const existingByKey = new Map<string, string>()
  for (const e of existing ?? []) {
    existingByKey.set(variantKey(e.attributes ?? {}), e.id)
  }

  const incomingIds = new Set<string>()
  const toUpsert: Array<Record<string, unknown>> = []

  data.variants.forEach((v, idx) => {
    const id = v.id ?? existingByKey.get(variantKey(v.attributes))
    if (id) incomingIds.add(id)
    toUpsert.push({
      id,
      tenant_id: tenant.id,
      product_id: productId,
      attributes: v.attributes,
      sku: v.sku || null,
      barcode: v.barcode || null,
      price: v.price,
      compare_at_price: v.compare_at_price ?? null,
      cost: v.cost ?? null,
      stock: v.stock,
      status: v.status,
      position: idx,
    })
  })

  if (toUpsert.length > 0) {
    const { error: upErr } = await supabase
      .from("product_variants")
      .upsert(toUpsert, { onConflict: "id" })
    if (upErr) return { ok: false, error: upErr.message }
  }

  // Delete variants no longer present
  const toDelete = (existing ?? []).filter((e) => !incomingIds.has(e.id)).map((e) => e.id)
  if (toDelete.length > 0) {
    const { error: delErr } = await supabase
      .from("product_variants")
      .delete()
      .in("id", toDelete)
      .eq("tenant_id", tenant.id)
    if (delErr) return { ok: false, error: delErr.message }
  }

  revalidatePath(`/app/${tenantSlug}/products`)
  revalidatePath(`/app/${tenantSlug}/products/${productId}`)

  return { ok: true, productId }
}

export async function deleteProduct(tenantSlug: string, id: string): Promise<ProductFormState> {
  const { tenant } = await requireTenant(tenantSlug)
  const supabase = await createClient()
  const { error } = await supabase.from("products").delete().eq("id", id).eq("tenant_id", tenant.id)
  if (error) return { ok: false, error: error.message }

  revalidatePath(`/app/${tenantSlug}/products`)
  redirect(`/app/${tenantSlug}/products`)
}
