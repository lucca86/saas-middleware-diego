import "server-only"
import { createClient } from "@/lib/supabase/server"
import { imageProxyUrl } from "@/lib/r2/image-url"
import type {
  AttributeDef,
  Category,
  Product,
  ProductAttributesData,
  ProductType,
  ProductVariant,
  ProductWithCounts,
  SizeCurve,
} from "./types"

export interface ProductListFilters {
  search?: string
  status?: "all" | "draft" | "active" | "archived"
  typeId?: string
  categoryId?: string
}

/** List product types for a tenant. */
export async function listProductTypes(tenantId: string): Promise<ProductType[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("product_types")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("is_system", { ascending: false })
    .order("name", { ascending: true })

  if (error) throw error
  return (data ?? []).map((t) => ({
    ...t,
    attributes: (t.attributes ?? []) as AttributeDef[],
  }))
}

export async function getProductType(
  tenantId: string,
  id: string,
): Promise<ProductType | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("product_types")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  return { ...data, attributes: (data.attributes ?? []) as AttributeDef[] }
}

export async function listCategories(tenantId: string): Promise<Category[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("position", { ascending: true })
    .order("name", { ascending: true })

  if (error) throw error
  return (data ?? []) as Category[]
}

export async function listSizeCurves(tenantId: string): Promise<SizeCurve[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("size_curves")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("is_system", { ascending: false })
    .order("name", { ascending: true })

  if (error) throw error
  return (data ?? []).map((c) => ({ ...c, values: c.values ?? [] })) as SizeCurve[]
}

/**
 * Paginated product listing with filters. Uses a single query + client-side
 * aggregation for the variant counts (simpler than an RPC for now).
 */
export async function listProducts(
  tenantId: string,
  filters: ProductListFilters = {},
): Promise<ProductWithCounts[]> {
  const supabase = await createClient()
  let q = supabase
    .from("products")
    .select(
      `
      id, tenant_id, type_id, category_id, sku, name, slug, description, status,
      category, tags, attributes, created_at, updated_at,
      product_types!products_type_id_fkey(name),
      categories!products_category_id_fkey(name),
      product_variants(id, price, stock),
      product_images(storage_key, url, is_primary, position)
      `,
    )
    .eq("tenant_id", tenantId)
    .order("updated_at", { ascending: false })
    .limit(200)

  if (filters.search && filters.search.trim().length > 0) {
    q = q.ilike("name", `%${filters.search.trim()}%`)
  }
  if (filters.status && filters.status !== "all") {
    q = q.eq("status", filters.status)
  }
  if (filters.typeId) {
    q = q.eq("type_id", filters.typeId)
  }
  if (filters.categoryId) {
    q = q.eq("category_id", filters.categoryId)
  }

  const { data, error } = await q
  if (error) throw error

  return (data ?? []).map((p) => {
    const variants = (p.product_variants ?? []) as Array<{ price: number; stock: number }>
    const ptype = Array.isArray(p.product_types) ? p.product_types[0] : p.product_types
    const cat = Array.isArray(p.categories) ? p.categories[0] : p.categories
    const prices = variants.map((v) => Number(v.price)).filter((n) => !Number.isNaN(n))
    const images = (p.product_images ?? []) as Array<{
      storage_key: string
      url: string
      is_primary: boolean
      position: number
    }>
    const primary =
      images.find((i) => i.is_primary) ??
      [...images].sort((a, b) => a.position - b.position)[0] ??
      null
    // Use R2 proxy when storage_key exists, otherwise fall back to the raw URL
    const primaryImageUrl = primary
      ? (imageProxyUrl(primary.storage_key) ?? primary.url ?? null)
      : null
    return {
      id: p.id,
      tenant_id: p.tenant_id,
      type_id: p.type_id,
      category_id: p.category_id,
      sku: p.sku,
      name: p.name,
      slug: p.slug,
      description: p.description,
      status: p.status,
      category: p.category,
      tags: p.tags ?? [],
      attributes: (p.attributes ?? {}) as ProductAttributesData,
      created_at: p.created_at,
      updated_at: p.updated_at,
      variant_count: variants.length,
      total_stock: variants.reduce((acc, v) => acc + (v.stock ?? 0), 0),
      min_price: prices.length > 0 ? Math.min(...prices) : null,
      type_name: ptype?.name ?? null,
      category_name: cat?.name ?? null,
      primary_image_url: primaryImageUrl,
    } as ProductWithCounts
  })
}

export async function getProduct(
  tenantId: string,
  id: string,
): Promise<{ product: Product; variants: ProductVariant[] } | null> {
  const supabase = await createClient()

  const { data: product, error } = await supabase
    .from("products")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .maybeSingle()

  if (error) throw error
  if (!product) return null

  const { data: variants, error: vErr } = await supabase
    .from("product_variants")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("product_id", id)
    .order("position", { ascending: true })

  if (vErr) throw vErr

  return {
    product: {
      ...product,
      tags: product.tags ?? [],
      attributes: (product.attributes ?? {}) as ProductAttributesData,
    } as Product,
    variants: (variants ?? []) as ProductVariant[],
  }
}

/** Quick counters for the products header. */
export async function productCounts(tenantId: string): Promise<{
  total: number
  draft: number
  active: number
  archived: number
}> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("products")
    .select("status")
    .eq("tenant_id", tenantId)

  if (error) throw error
  const rows = data ?? []
  return {
    total: rows.length,
    draft: rows.filter((r) => r.status === "draft").length,
    active: rows.filter((r) => r.status === "active").length,
    archived: rows.filter((r) => r.status === "archived").length,
  }
}
