/**
 * Shared types for the catálogo module.
 *
 * A `product_type` declares a dynamic list of attributes. Attributes flagged
 * with `is_variant = true` are combined (cartesian product) to generate
 * variant rows; attributes with `is_variant = false` live on the parent
 * product.
 */

export type AttributeType = "text" | "number" | "select"

export interface AttributeDef {
  key: string
  label: string
  type: AttributeType
  /** Manual options for `select` attributes when no source_curve_id is set. */
  options?: string[]
  /** When set, the attribute gets its options from a SizeCurve. */
  source_curve_id?: string | null
  is_variant: boolean
  required?: boolean
  help?: string
}

export interface ProductType {
  id: string
  tenant_id: string
  name: string
  slug: string
  icon: string | null
  description: string | null
  attributes: AttributeDef[]
  is_system: boolean
  created_at: string
  updated_at: string
}

export interface Category {
  id: string
  tenant_id: string
  name: string
  slug: string
  description: string | null
  position: number
  created_at: string
  updated_at: string
}

export type OptionListKind = "size" | "color" | "material" | "other"

export const OPTION_LIST_KIND_LABELS: Record<OptionListKind, string> = {
  size: "Talles",
  color: "Colores",
  material: "Materiales",
  other: "Otra",
}

export interface SizeCurve {
  id: string
  tenant_id: string
  name: string
  slug: string
  description: string | null
  kind: OptionListKind
  values: string[]
  is_system: boolean
  created_at: string
  updated_at: string
}

export type ProductStatus = "draft" | "active" | "archived"

/**
 * Selection of values applicable to a product for a given variant attribute.
 * Stored under `products.attributes.selections.<attribute_key>`.
 *
 * - `values`: the subset of options the user wants this product to expose.
 * - `curve_id`: optional override to pick a different SizeCurve than the one
 *   declared at the product type level.
 */
export interface AttributeSelection {
  values: string[]
  curve_id?: string | null
}

/**
 * Shape of `products.attributes` JSONB column.
 *
 * `selections`: per variant attribute, the active values + optional curve override.
 * `values`: per non-variant attribute (text/number), the literal value.
 */
export interface ProductAttributesData {
  selections?: Record<string, AttributeSelection>
  values?: Record<string, string | number>
}

export interface Product {
  id: string
  tenant_id: string
  type_id: string | null
  category_id: string | null
  sku: string | null
  name: string
  slug: string
  description: string | null
  status: ProductStatus
  /** Legacy free-text category. New products use category_id. */
  category: string | null
  tags: string[]
  attributes: ProductAttributesData
  created_at: string
  updated_at: string
}

export type VariantStatus = "active" | "archived"

export interface ProductVariant {
  id: string
  product_id: string
  tenant_id: string
  sku: string | null
  barcode: string | null
  attributes: Record<string, string>
  price: number
  compare_at_price: number | null
  cost: number | null
  stock: number
  low_stock_threshold: number | null
  weight_grams: number | null
  status: VariantStatus
  position: number
  created_at: string
  updated_at: string
}

export interface ProductWithCounts extends Product {
  variant_count: number
  total_stock: number
  min_price: number | null
  type_name: string | null
  category_name: string | null
  primary_image_url: string | null
}
