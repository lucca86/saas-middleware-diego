import type { Category, Product, ProductVariant } from "@/lib/products/types"

/**
 * Public-facing storefront configuration. Stored as JSONB on
 * `tenants.storefront_config`. All fields are optional; the storefront falls
 * back to sensible defaults when missing.
 */
export interface StorefrontConfig {
  /** Big title rendered on the hero. Defaults to the tenant name. */
  hero_title?: string
  /** Sub-headline below the hero title. */
  hero_subtitle?: string
  /** Long-form "about" text shown below the product grid. */
  about?: string
  /** WhatsApp number in E.164 without the leading +. Eg: "5491155557777". */
  whatsapp?: string
  /** Message template. Supports {product} and {url} placeholders. */
  whatsapp_template?: string
  /** Instagram handle (no @). */
  instagram?: string
  /** Public contact email. */
  email?: string
  /** Brand accent color (hex). */
  accent?: string
  /** Hide variants with stock=0 from the public catalog. */
  hide_out_of_stock?: boolean
  /** Don't show prices (e.g. wholesale-only stores). */
  hide_prices?: boolean
}

export interface PublicTenant {
  id: string
  slug: string
  name: string
  currency: string
  storefront_config: StorefrontConfig
  is_storefront_published: boolean
}

export interface PublicProductImage {
  url: string
  alt: string | null
  position: number
  is_primary: boolean
}

export interface PublicProductCard {
  id: string
  slug: string
  name: string
  description: string | null
  category_id: string | null
  category_name: string | null
  type_name: string | null
  min_price: number | null
  max_price: number | null
  has_stock: boolean
  primary_image: string | null
}

export interface PublicProductDetail {
  product: Pick<
    Product,
    "id" | "tenant_id" | "name" | "slug" | "description" | "category_id" | "tags" | "attributes"
  > & {
    type_name: string | null
    category_name: string | null
    category_slug: string | null
  }
  variants: ProductVariant[]
  images: PublicProductImage[]
}

export interface PublicCategory extends Pick<Category, "id" | "name" | "slug"> {
  product_count: number
}
