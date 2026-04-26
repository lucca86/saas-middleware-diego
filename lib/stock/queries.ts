import "server-only"
import { createClient } from "@/lib/supabase/server"
import type {
  StockMovement,
  StockMovementType,
  StockMovementWithContext,
  VariantStockRow,
} from "./types"

interface ListMovementsFilters {
  variantId?: string
  productId?: string
  type?: StockMovementType | "all"
  search?: string
  limit?: number
}

/**
 * Lists movements joined with their product/variant context. Uses a single
 * query because Postgres lets us pull related rows via embedded selects, and
 * keeps it small (default 200 rows; the page paginates client-side).
 */
export async function listStockMovements(
  tenantId: string,
  filters: ListMovementsFilters = {},
): Promise<StockMovementWithContext[]> {
  const supabase = await createClient()
  let q = supabase
    .from("stock_movements")
    .select(
      `
      id, tenant_id, variant_id, product_id, type, qty, reason, notes, reference,
      created_by, created_at,
      products:product_id ( name, slug ),
      product_variants:variant_id ( sku, attributes )
      `,
    )
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(filters.limit ?? 200)

  if (filters.variantId) q = q.eq("variant_id", filters.variantId)
  if (filters.productId) q = q.eq("product_id", filters.productId)
  if (filters.type && filters.type !== "all") q = q.eq("type", filters.type)

  const { data, error } = await q
  if (error) throw error

  return (data ?? []).map((row) => {
    const p = Array.isArray(row.products) ? row.products[0] : row.products
    const v = Array.isArray(row.product_variants) ? row.product_variants[0] : row.product_variants
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      variant_id: row.variant_id,
      product_id: row.product_id,
      type: row.type as StockMovementType,
      qty: row.qty,
      reason: row.reason,
      notes: row.notes,
      reference: row.reference,
      created_by: row.created_by,
      created_at: row.created_at,
      product_name: p?.name ?? null,
      product_slug: p?.slug ?? null,
      variant_sku: v?.sku ?? null,
      variant_attributes: (v?.attributes ?? {}) as Record<string, string>,
      user_email: null,
    } satisfies StockMovementWithContext
  })
}

/** Movements for a single variant — used by the per-variant history dialog. */
export async function listVariantHistory(
  tenantId: string,
  variantId: string,
): Promise<StockMovement[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("stock_movements")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("variant_id", variantId)
    .order("created_at", { ascending: false })
    .limit(200)
  if (error) throw error
  return (data ?? []) as StockMovement[]
}

/**
 * All variants for a tenant with their cached stock and product context.
 * The /stock page uses this to render the rollup table.
 */
export async function listVariantStock(tenantId: string): Promise<VariantStockRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("product_variants")
    .select(
      `
      id, product_id, sku, attributes, stock, status,
      products:product_id ( name, slug, status, product_images ( url, is_primary, position ) )
      `,
    )
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(1000)

  if (error) throw error

  return (data ?? [])
    .map((row) => {
      const p = Array.isArray(row.products) ? row.products[0] : row.products
      if (!p) return null
      const images = (p.product_images ?? []) as Array<{
        url: string
        is_primary: boolean
        position: number
      }>
      const primary =
        images.find((i) => i.is_primary) ??
        [...images].sort((a, b) => a.position - b.position)[0] ??
        null
      return {
        variant_id: row.id,
        product_id: row.product_id,
        product_name: p.name,
        product_slug: p.slug,
        variant_sku: row.sku ?? null,
        variant_attributes: (row.attributes ?? {}) as Record<string, string>,
        stock: row.stock ?? 0,
        status: row.status as "active" | "archived",
        primary_image_url: primary?.url ?? null,
      } satisfies VariantStockRow
    })
    .filter((r): r is VariantStockRow => r !== null)
}

/**
 * High-level KPIs for the /stock dashboard header.
 */
export async function stockSummary(tenantId: string): Promise<{
  totalUnits: number
  variantsTracked: number
  outOfStock: number
  lowStock: number
  movementsLast7Days: number
}> {
  const supabase = await createClient()
  const [variants, movements] = await Promise.all([
    supabase
      .from("product_variants")
      .select("stock, status")
      .eq("tenant_id", tenantId)
      .eq("status", "active"),
    supabase
      .from("stock_movements")
      .select("id")
      .eq("tenant_id", tenantId)
      .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
  ])
  if (variants.error) throw variants.error
  if (movements.error) throw movements.error

  const rows = variants.data ?? []
  return {
    totalUnits: rows.reduce((acc, r) => acc + (r.stock ?? 0), 0),
    variantsTracked: rows.length,
    outOfStock: rows.filter((r) => (r.stock ?? 0) <= 0).length,
    lowStock: rows.filter((r) => (r.stock ?? 0) > 0 && (r.stock ?? 0) <= 3).length,
    movementsLast7Days: movements.data?.length ?? 0,
  }
}
