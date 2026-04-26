import "server-only"
import { createClient } from "@/lib/supabase/server"
import { imageProxyUrl } from "@/lib/r2/image-url"

export type DashboardSummary = {
  productsActive: number
  productsDraft: number
  variantsTotal: number
  unitsOnHand: number
  inventoryValue: number
  outOfStockCount: number
  lowStockCount: number
  movements7d: number
  storefrontPublished: boolean
}

export type LowStockRow = {
  variant_id: string
  product_id: string
  product_slug: string
  product_name: string
  attributes: Record<string, string>
  stock: number
  primary_image_url: string | null
}

export type MovementRow = {
  id: string
  type: "initial" | "in" | "out" | "adjustment"
  qty: number
  reason: string | null
  created_at: string
  product_name: string
  product_slug: string
  attributes: Record<string, string>
}

const LOW_STOCK_THRESHOLD = 5

export async function getDashboardSummary(tenantId: string): Promise<DashboardSummary> {
  const supabase = await createClient()

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { data: products },
    { data: variants },
    { count: movements7d },
    { data: tenantRow },
  ] = await Promise.all([
    supabase.from("products").select("status").eq("tenant_id", tenantId),
    supabase
      .from("product_variants")
      .select("stock, cost, status")
      .eq("tenant_id", tenantId),
    supabase
      .from("stock_movements")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .gte("created_at", sevenDaysAgo),
    supabase
      .from("tenants")
      .select("is_storefront_published")
      .eq("id", tenantId)
      .maybeSingle(),
  ])

  const productsActive = (products ?? []).filter((p) => p.status === "active").length
  const productsDraft = (products ?? []).filter((p) => p.status === "draft").length

  const activeVariants = (variants ?? []).filter((v) => v.status === "active")
  const unitsOnHand = activeVariants.reduce((acc, v) => acc + (v.stock ?? 0), 0)
  const inventoryValue = activeVariants.reduce(
    (acc, v) => acc + (v.stock ?? 0) * Number(v.cost ?? 0),
    0,
  )
  const outOfStockCount = activeVariants.filter((v) => (v.stock ?? 0) <= 0).length
  const lowStockCount = activeVariants.filter(
    (v) => (v.stock ?? 0) > 0 && (v.stock ?? 0) <= LOW_STOCK_THRESHOLD,
  ).length

  return {
    productsActive,
    productsDraft,
    variantsTotal: activeVariants.length,
    unitsOnHand,
    inventoryValue,
    outOfStockCount,
    lowStockCount,
    movements7d: movements7d ?? 0,
    storefrontPublished: Boolean(tenantRow?.is_storefront_published),
  }
}

export async function getLowStockVariants(
  tenantId: string,
  limit = 10,
): Promise<LowStockRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("product_variants")
    .select(
      `id, product_id, attributes, stock,
       products!inner(slug, name, status, product_images(storage_key, is_primary, position))`,
    )
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .lte("stock", LOW_STOCK_THRESHOLD)
    .order("stock", { ascending: true })
    .limit(limit)

  return ((data ?? []) as Array<{
    id: string
    product_id: string
    attributes: Record<string, string>
    stock: number
    products: {
      slug: string
      name: string
      status: string
      product_images: Array<{ storage_key: string; is_primary: boolean; position: number }>
    }
  }>)
    .filter((row) => row.products?.status === "active")
    .map((row) => {
      const images = row.products.product_images ?? []
      const primary =
        images.find((i) => i.is_primary) ??
        [...images].sort((a, b) => a.position - b.position)[0]
      return {
        variant_id: row.id,
        product_id: row.product_id,
        product_slug: row.products.slug,
        product_name: row.products.name,
        attributes: row.attributes ?? {},
        stock: row.stock ?? 0,
        primary_image_url: imageProxyUrl(primary?.storage_key) ?? null,
      } satisfies LowStockRow
    })
}

export async function getRecentMovements(tenantId: string, limit = 10): Promise<MovementRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("stock_movements")
    .select(
      `id, type, qty, reason, created_at,
       products:product_id ( name, slug ),
       product_variants:variant_id ( attributes )`,
    )
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(limit)

  return ((data ?? []) as Array<{
    id: string
    type: MovementRow["type"]
    qty: number
    reason: string | null
    created_at: string
    products: { name: string; slug: string } | null
    product_variants: { attributes: Record<string, string> } | null
  }>).map((row) => ({
    id: row.id,
    type: row.type,
    qty: row.qty,
    reason: row.reason,
    created_at: row.created_at,
    product_name: row.products?.name ?? "Producto",
    product_slug: row.products?.slug ?? "",
    attributes: row.product_variants?.attributes ?? {},
  }))
}
