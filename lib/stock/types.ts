export type StockMovementType = "initial" | "in" | "out" | "adjustment"

export const STOCK_MOVEMENT_LABELS: Record<StockMovementType, string> = {
  initial: "Stock inicial",
  in: "Entrada",
  out: "Salida",
  adjustment: "Ajuste",
}

/** Suggested reasons per movement type. UI offers them as a Select. */
export const STOCK_MOVEMENT_REASONS: Record<StockMovementType, string[]> = {
  initial: ["Stock inicial"],
  in: ["Compra", "Devolución cliente", "Producción", "Reingreso", "Otro"],
  out: ["Venta", "Pérdida", "Defectuoso", "Devolución a proveedor", "Uso interno", "Otro"],
  adjustment: ["Conteo físico", "Corrección de error", "Diferencia de inventario", "Otro"],
}

export interface StockMovement {
  id: string
  tenant_id: string
  variant_id: string
  product_id: string
  /** Movement type. `initial` is reserved (created by trigger/migration). */
  type: StockMovementType
  /**
   * Signed quantity delta applied to product_variants.stock.
   * - `in` and `initial` are always positive
   * - `out` is always negative
   * - `adjustment` can be either (it's a delta toward a target)
   */
  qty: number
  reason: string | null
  notes: string | null
  reference: string | null
  created_by: string | null
  created_at: string
}

export interface StockMovementWithContext extends StockMovement {
  product_name: string | null
  product_slug: string | null
  variant_attributes: Record<string, string>
  variant_sku: string | null
  user_email: string | null
}

export interface VariantStockRow {
  variant_id: string
  product_id: string
  product_name: string
  product_slug: string
  variant_sku: string | null
  variant_attributes: Record<string, string>
  stock: number
  status: "active" | "archived"
  primary_image_url: string | null
}

/**
 * Pretty-print variant attributes as a single label, e.g. "M · Negro".
 * Falls back to "Default" when there are no attributes (simple product).
 */
export function variantLabel(attrs: Record<string, string> | null | undefined): string {
  if (!attrs) return "Default"
  const values = Object.values(attrs).filter((v) => typeof v === "string" && v.length > 0)
  if (values.length === 0) return "Default"
  return values.join(" · ")
}
