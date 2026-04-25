"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { requireTenant } from "@/lib/tenant/context"
import { deleteR2Object } from "@/lib/r2/client"

const RegisterSchema = z.object({
  productId: z.string().uuid(),
  storageKey: z.string().min(1),
  url: z.string().url(),
  width: z.number().int().nullable().optional(),
  height: z.number().int().nullable().optional(),
  sizeBytes: z.number().int().nullable().optional(),
  mimeType: z.string().nullable().optional(),
})

/**
 * Register an image in the database after a successful R2 upload.
 * If it's the first image of the product, mark it as primary automatically.
 */
export async function registerProductImage(
  tenantSlug: string,
  input: z.infer<typeof RegisterSchema>,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const parsed = RegisterSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message ?? "Datos inválidos" }

  const { tenant, role } = await requireTenant(tenantSlug)
  if (!["owner", "admin", "operator"].includes(role)) {
    return { ok: false, error: "Sin permiso" }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "No autenticado" }

  // Verify product belongs to tenant
  const { data: product } = await supabase
    .from("products")
    .select("id, tenant_id")
    .eq("id", parsed.data.productId)
    .eq("tenant_id", tenant.id)
    .maybeSingle()

  if (!product) return { ok: false, error: "Producto no encontrado" }

  // Determine next position and whether this is the first image
  const { data: existing } = await supabase
    .from("product_images")
    .select("id, position")
    .eq("product_id", product.id)
    .order("position", { ascending: false })
    .limit(1)

  const position = existing && existing[0] ? existing[0].position + 1 : 0
  const isPrimary = position === 0

  const { data, error } = await supabase
    .from("product_images")
    .insert({
      tenant_id: tenant.id,
      product_id: product.id,
      storage_key: parsed.data.storageKey,
      url: parsed.data.url,
      width: parsed.data.width ?? null,
      height: parsed.data.height ?? null,
      size_bytes: parsed.data.sizeBytes ?? null,
      mime_type: parsed.data.mimeType ?? null,
      position,
      is_primary: isPrimary,
      uploaded_by: user.id,
    })
    .select("id")
    .single()

  if (error) return { ok: false, error: error.message }

  revalidatePath(`/app/${tenantSlug}/products/${product.id}`)
  revalidatePath(`/app/${tenantSlug}/products`)
  return { ok: true, id: data.id }
}

/** Delete an image: removes the row in DB and the object in R2. */
export async function deleteProductImage(
  tenantSlug: string,
  imageId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { tenant, role } = await requireTenant(tenantSlug)
  if (!["owner", "admin", "operator"].includes(role)) {
    return { ok: false, error: "Sin permiso" }
  }

  const supabase = await createClient()
  const { data: image, error } = await supabase
    .from("product_images")
    .select("id, product_id, storage_key, is_primary")
    .eq("id", imageId)
    .eq("tenant_id", tenant.id)
    .maybeSingle()

  if (error || !image) return { ok: false, error: "Imagen no encontrada" }

  // Delete from DB first (cheap to retry; R2 deletion is best-effort)
  const { error: delErr } = await supabase.from("product_images").delete().eq("id", imageId)
  if (delErr) return { ok: false, error: delErr.message }

  // If we deleted the primary, promote the next one (lowest position)
  if (image.is_primary) {
    const { data: next } = await supabase
      .from("product_images")
      .select("id")
      .eq("product_id", image.product_id)
      .order("position", { ascending: true })
      .limit(1)

    if (next && next[0]) {
      await supabase.from("product_images").update({ is_primary: true }).eq("id", next[0].id)
    }
  }

  // Best-effort R2 cleanup; ignore errors so DB stays the source of truth
  try {
    await deleteR2Object(image.storage_key)
  } catch {
    // swallow
  }

  revalidatePath(`/app/${tenantSlug}/products/${image.product_id}`)
  revalidatePath(`/app/${tenantSlug}/products`)
  return { ok: true }
}

/** Promote an image to primary for its product. */
export async function setPrimaryImage(
  tenantSlug: string,
  imageId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { tenant, role } = await requireTenant(tenantSlug)
  if (!["owner", "admin", "operator"].includes(role)) {
    return { ok: false, error: "Sin permiso" }
  }

  const supabase = await createClient()
  const { data: image } = await supabase
    .from("product_images")
    .select("id, product_id")
    .eq("id", imageId)
    .eq("tenant_id", tenant.id)
    .maybeSingle()

  if (!image) return { ok: false, error: "Imagen no encontrada" }

  // Unset previous primary (the partial unique index forbids two primaries)
  const { error: unsetErr } = await supabase
    .from("product_images")
    .update({ is_primary: false })
    .eq("product_id", image.product_id)
    .eq("is_primary", true)
  if (unsetErr) return { ok: false, error: unsetErr.message }

  const { error: setErr } = await supabase
    .from("product_images")
    .update({ is_primary: true })
    .eq("id", imageId)
  if (setErr) return { ok: false, error: setErr.message }

  revalidatePath(`/app/${tenantSlug}/products/${image.product_id}`)
  revalidatePath(`/app/${tenantSlug}/products`)
  return { ok: true }
}

/** Persist a new ordering of images. */
export async function reorderProductImages(
  tenantSlug: string,
  productId: string,
  orderedIds: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { tenant, role } = await requireTenant(tenantSlug)
  if (!["owner", "admin", "operator"].includes(role)) {
    return { ok: false, error: "Sin permiso" }
  }

  const supabase = await createClient()
  // Update positions one by one (small list, simpler than bulk upsert)
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from("product_images")
      .update({ position: i })
      .eq("id", orderedIds[i])
      .eq("tenant_id", tenant.id)
      .eq("product_id", productId)
    if (error) return { ok: false, error: error.message }
  }

  revalidatePath(`/app/${tenantSlug}/products/${productId}`)
  return { ok: true }
}
