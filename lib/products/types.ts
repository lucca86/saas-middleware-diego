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
  options?: string[]
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

export type ProductStatus = "draft" | "active" | "archived"

export interface Product {
  id: string
  tenant_id: string
  type_id: string | null
  sku: string | null
  name: string
  slug: string
  description: string | null
  status: ProductStatus
  category: string | null
  tags: string[]
  attributes: Record<string, unknown>
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
}
