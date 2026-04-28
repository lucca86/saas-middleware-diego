import "server-only"
import { cache } from "react"
import { createPublicClient } from "@/lib/supabase/public"
import { imageProxyUrl } from "@/lib/r2/image-url"
import type {
  ProductAttributesData,
  ProductVariant,
} from "@/lib/products/types"
import type {
  PublicCategory,
  PublicProductCard,
  PublicProductDetail,
  PublicProductImage,
  PublicTenant,
  StorefrontConfig,
} from "./types"

/** Resolve a tenant by slug. Returns null when the storefront isn't published. */
export const getPublicTenant = cache(async (slug: string): Promise<PublicTenant | null> => {
  const supabase = createPublicClient()
  const { data, error } = await supabase
    .from("tenants")
    .select("id, slug, name, currency, storefront_config, is_storefront_published")
    .eq("slug", slug)
    .eq("is_storefront_published", true)
    .maybeSingle()

  if (error || !data) return null
  return {
    id: data.id,
    slug: data.slug,
    name: data.name,
    currency: data.currency,
    storefront_config: (data.storefront_config ?? {}) as StorefrontConfig,
    is_storefront_published: data.is_storefront_published,
  }
})

export type PublicSort = "newest" | "price-asc" | "price-desc" | "name"

export interface PublicListFilters {
  categorySlug?: string
  search?: string
  sort?: PublicSort
  inStock?: boolean
}

/** List active products with their summary info for a published tenant. */
export async function listPublicProducts(
  tenantId: string,
  filters: PublicListFilters = {},
  options: { hideOutOfStock?: boolean } = {},
): Promise<PublicProductCard[]> {
  const supabase = createPublicClient()
  // We always paginate at the DB by `updated_at` and re-sort the resulting
  // cards in JS afterwards. Sorting by `min_price` requires aggregating
  // variants, which we already compute below — doing it in SQL would force a
  // less reusable query for each sort key.
  let q = supabase
    .from("products")
    .select(
      `
      id, slug, name, description, category_id,
      product_types!products_type_id_fkey(name),
      categories!products_category_id_fkey(id, name, slug),
      product_variants(price, stock, status),
      product_images(storage_key, url, position, is_primary)
      `,
    )
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(120)

  if (filters.search && filters.search.trim().length > 0) {
    q = q.ilike("name", `%${filters.search.trim()}%`)
  }

  const { data, error } = await q
  if (error) throw error

  const cards = (data ?? []).map((p) => {
    const cat = Array.isArray(p.categories) ? p.categories[0] : p.categories
    const ptype = Array.isArray(p.product_types) ? p.product_types[0] : p.product_types
    const variants = (p.product_variants ?? []) as Array<{
      price: number
      stock: number
      status: "active" | "archived"
    }>
    const active = variants.filter((v) => v.status === "active")
    const prices = active.map((v) => Number(v.price)).filter((n) => !Number.isNaN(n))
    const totalStock = active.reduce((acc, v) => acc + (v.stock ?? 0), 0)
    const images = (p.product_images ?? []) as Array<{
      storage_key: string
      url: string
      position: number
      is_primary: boolean
    }>
    const primary =
      images.find((i) => i.is_primary) ??
      [...images].sort((a, b) => a.position - b.position)[0] ??
      null

    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      description: p.description,
      category_id: p.category_id,
      category_name: cat?.name ?? null,
      type_name: ptype?.name ?? null,
      min_price: prices.length > 0 ? Math.min(...prices) : null,
      max_price: prices.length > 0 ? Math.max(...prices) : null,
      has_stock: totalStock > 0,
      primary_image: imageProxyUrl(primary?.storage_key) ?? null,
      _category_slug: cat?.slug ?? null,
    } as PublicProductCard & { _category_slug: string | null }
  })

  let filtered = cards
  if (filters.categorySlug) {
    filtered = filtered.filter((c) => c._category_slug === filters.categorySlug)
  }
  if (options.hideOutOfStock || filters.inStock) {
    filtered = filtered.filter((c) => c.has_stock)
  }

  // Sort. Default order from the DB is `updated_at desc`, which we map to
  // "newest". Price sort uses min_price; products without price go last.
  const sort: PublicSort = filters.sort ?? "newest"
  if (sort === "price-asc" || sort === "price-desc") {
    const dir = sort === "price-asc" ? 1 : -1
    filtered.sort((a, b) => {
      const ap = a.min_price ?? Number.POSITIVE_INFINITY
      const bp = b.min_price ?? Number.POSITIVE_INFINITY
      return (ap - bp) * dir
    })
  } else if (sort === "name") {
    filtered.sort((a, b) => a.name.localeCompare(b.name, "es"))
  }
  // "newest" — already in DB order.

  return filtered.map(({ _category_slug, ...rest }) => rest)
}

/**
 * Featured shelf for the storefront home: the most recently updated active
 * products that have stock and at least one image. We keep it small (8) so
 * the section reads as a curated row, not a duplicate of the main grid.
 */
export async function listFeaturedProducts(
  tenantId: string,
  limit = 8,
): Promise<PublicProductCard[]> {
  const all = await listPublicProducts(
    tenantId,
    { sort: "newest", inStock: true },
  )
  return all.filter((p) => p.primary_image).slice(0, limit)
}

/**
 * Related products for the PDP. Same category as the current product when
 * possible; falls back to the latest from the same tenant. Excludes the
 * current product and out-of-stock items.
 */
export async function listRelatedProducts(
  tenantId: string,
  currentProductId: string,
  categoryId: string | null,
  limit = 4,
): Promise<PublicProductCard[]> {
  // Delegated to listPublicProducts so we reuse its card-shaping logic.
  // We sort/filter in JS over the same cards because the result set is small.
  const all = await listPublicProducts(tenantId, { inStock: true })
  const sameCategory = categoryId
    ? all.filter((p) => p.id !== currentProductId && p.category_id === categoryId)
    : []
  if (sameCategory.length >= limit) return sameCategory.slice(0, limit)

  const filler = all.filter(
    (p) => p.id !== currentProductId && !sameCategory.find((s) => s.id === p.id),
  )
  return [...sameCategory, ...filler].slice(0, limit)
}

export async function listPublicCategories(tenantId: string): Promise<PublicCategory[]> {
  const supabase = createPublicClient()
  const [{ data: cats, error: catErr }, { data: prods, error: prodErr }] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name, slug, position")
      .eq("tenant_id", tenantId)
      .order("position", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("products")
      .select("category_id")
      .eq("tenant_id", tenantId)
      .eq("status", "active"),
  ])
  if (catErr) throw catErr
  if (prodErr) throw prodErr

  const counts = new Map<string, number>()
  ;(prods ?? []).forEach((p) => {
    if (p.category_id) counts.set(p.category_id, (counts.get(p.category_id) ?? 0) + 1)
  })

  return (cats ?? [])
    .map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      product_count: counts.get(c.id) ?? 0,
    }))
    .filter((c) => c.product_count > 0)
}

export async function getPublicProductBySlug(
  tenantId: string,
  productSlug: string,
): Promise<PublicProductDetail | null> {
  const supabase = createPublicClient()

  const { data: product, error } = await supabase
    .from("products")
    .select(
      `
      id, tenant_id, name, slug, description, category_id, tags, attributes,
      product_types!products_type_id_fkey(name),
      categories!products_category_id_fkey(name, slug)
      `,
    )
    .eq("tenant_id", tenantId)
    .eq("slug", productSlug)
    .eq("status", "active")
    .maybeSingle()

  if (error || !product) return null

  const ptype = Array.isArray(product.product_types) ? product.product_types[0] : product.product_types
  const cat = Array.isArray(product.categories) ? product.categories[0] : product.categories
  const catSlug = (cat as { slug?: string } | null | undefined)?.slug ?? null

  const [{ data: variants }, { data: images }] = await Promise.all([
    supabase
      .from("product_variants")
      .select("*")
      .eq("product_id", product.id)
      .eq("status", "active")
      .order("position", { ascending: true }),
    supabase
      .from("product_images")
      .select("storage_key, url, alt, position, is_primary")
      .eq("product_id", product.id)
      .order("is_primary", { ascending: false })
      .order("position", { ascending: true }),
  ])

  return {
    product: {
      id: product.id,
      tenant_id: product.tenant_id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      category_id: product.category_id,
      tags: product.tags ?? [],
      attributes: (product.attributes ?? {}) as ProductAttributesData,
      type_name: ptype?.name ?? null,
      category_name: cat?.name ?? null,
      category_slug: catSlug,
    },
    variants: (variants ?? []) as ProductVariant[],
    images: ((images ?? []) as Array<{
      storage_key: string
      url: string
      alt: string | null
      position: number
      is_primary: boolean
    }>).map(
      (i) =>
        ({
          url: imageProxyUrl(i.storage_key) ?? i.url,
          alt: i.alt,
          position: i.position,
          is_primary: i.is_primary,
        }) satisfies PublicProductImage,
    ),
  }
}

/**
 * For static-ish prebuilds: list the slugs of all published storefronts so
 * we can `generateStaticParams`.
 */
export async function listPublishedTenantSlugs(): Promise<string[]> {
  const supabase = createPublicClient()
  const { data, error } = await supabase
    .from("tenants")
    .select("slug")
    .eq("is_storefront_published", true)
  if (error) return []
  return (data ?? []).map((r) => r.slug)
}
