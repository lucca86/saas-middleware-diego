"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { requireTenant } from "@/lib/tenant/context"
import { slugify } from "@/lib/products/slug"
import { buildProducts, parseCsv, type ParsedProduct } from "@/lib/products/csv-import"

export type ImportSummary = {
  ok: boolean
  error?: string
  productsCreated: number
  variantsCreated: number
  initialMovements: number
  errors: Array<{ line: number; message: string }>
}

export async function importProductsFromCsv(
  tenantSlug: string,
  csvText: string,
  delimiter: "," | ";" | "\t" = ",",
): Promise<ImportSummary> {
  const { tenant, role } = await requireTenant(tenantSlug)
  if (!["owner", "admin", "operator"].includes(role)) {
    return { ok: false, error: "No tenés permisos para importar.", productsCreated: 0, variantsCreated: 0, initialMovements: 0, errors: [] }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, error: "No autenticado", productsCreated: 0, variantsCreated: 0, initialMovements: 0, errors: [] }
  }

  const rows = parseCsv(csvText, delimiter)
  if (rows.length === 0) {
    return {
      ok: false,
      error: "El archivo está vacío o no tiene encabezado.",
      productsCreated: 0,
      variantsCreated: 0,
      initialMovements: 0,
      errors: [],
    }
  }

  const { products, errors } = buildProducts(rows)
  if (products.length === 0) {
    return {
      ok: false,
      error: "No se detectó ningún producto válido.",
      productsCreated: 0,
      variantsCreated: 0,
      initialMovements: 0,
      errors,
    }
  }

  // Map existing categories so we can match by slug or name.
  const { data: categories } = await supabase
    .from("categories")
    .select("id, slug, name")
    .eq("tenant_id", tenant.id)
  const categoryById = new Map<string, { id: string; slug: string; name: string }>()
  ;(categories ?? []).forEach((c) => categoryById.set(c.slug.toLowerCase(), c))
  ;(categories ?? []).forEach((c) => categoryById.set(c.name.toLowerCase(), c))

  let productsCreated = 0
  let variantsCreated = 0
  let initialMovements = 0

  for (const p of products) {
    const slug = slugify(p.name).slice(0, 120) || slugify(`${p.name}-${Date.now()}`)
    const categoryId = p.category ? categoryById.get(p.category.toLowerCase())?.id ?? null : null

    const { data: createdProduct, error: prodErr } = await supabase
      .from("products")
      .insert({
        tenant_id: tenant.id,
        type_id: null,
        category_id: categoryId,
        name: p.name,
        slug,
        sku: p.sku,
        description: p.description,
        status: p.status,
        tags: p.tags,
        attributes: {},
        created_by: user.id,
      })
      .select("id")
      .single()

    if (prodErr || !createdProduct) {
      errors.push({
        line: 0,
        message: `"${p.name}": ${prodErr?.message ?? "no se pudo crear"}`,
      })
      continue
    }
    productsCreated++

    const variantRows = p.variants.map((v, idx) => ({
      tenant_id: tenant.id,
      product_id: createdProduct.id,
      attributes: v.attributes,
      sku: v.sku,
      barcode: v.barcode,
      price: v.price,
      compare_at_price: v.compare_at_price,
      cost: v.cost,
      stock: 0, // trigger will apply real qty from the initial movement
      status: "active" as const,
      position: idx,
    }))

    const { data: createdVariants, error: varErr } = await supabase
      .from("product_variants")
      .insert(variantRows)
      .select("id, attributes")

    if (varErr || !createdVariants) {
      errors.push({
        line: 0,
        message: `"${p.name}" - variantes: ${varErr?.message ?? "no se pudieron crear"}`,
      })
      continue
    }
    variantsCreated += createdVariants.length

    // Match each created variant back to its source row by attribute key to
    // emit the right initial movement.
    const movements = p.variants
      .map((src) => {
        if (src.stock <= 0) return null
        const target = createdVariants.find(
          (cv) =>
            JSON.stringify(cv.attributes ?? {}) === JSON.stringify(src.attributes ?? {}),
        )
        if (!target) return null
        return {
          tenant_id: tenant.id,
          product_id: createdProduct.id,
          variant_id: target.id,
          type: "initial" as const,
          qty: src.stock,
          reason: "Importado desde CSV",
          notes: null,
          created_by: user.id,
        }
      })
      .filter(<T>(v: T | null): v is T => v !== null)

    if (movements.length > 0) {
      const { error: movErr } = await supabase.from("stock_movements").insert(movements)
      if (movErr) {
        errors.push({ line: 0, message: `"${p.name}" - stock inicial: ${movErr.message}` })
      } else {
        initialMovements += movements.length
      }
    }
  }

  revalidatePath(`/app/${tenantSlug}/products`)
  revalidatePath(`/app/${tenantSlug}/dashboard`)

  return {
    ok: true,
    productsCreated,
    variantsCreated,
    initialMovements,
    errors,
  }
}

export async function previewCsvImport(
  csvText: string,
  delimiter: "," | ";" | "\t" = ",",
): Promise<{
  products: ParsedProduct[]
  errors: Array<{ line: number; message: string }>
  totalRows: number
}> {
  const rows = parseCsv(csvText, delimiter)
  return buildProducts(rows)
}
