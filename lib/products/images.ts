import "server-only"
import { createClient } from "@/lib/supabase/server"

export interface ProductImage {
  id: string
  product_id: string
  variant_id: string | null
  storage_key: string
  url: string
  width: number | null
  height: number | null
  size_bytes: number | null
  mime_type: string | null
  alt: string | null
  position: number
  is_primary: boolean
  created_at: string
}

export async function listProductImages(
  tenantId: string,
  productId: string,
): Promise<ProductImage[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("product_images")
    .select(
      "id, product_id, variant_id, storage_key, url, width, height, size_bytes, mime_type, alt, position, is_primary, created_at",
    )
    .eq("tenant_id", tenantId)
    .eq("product_id", productId)
    .order("is_primary", { ascending: false })
    .order("position", { ascending: true })

  if (error) throw error
  return (data ?? []) as ProductImage[]
}
