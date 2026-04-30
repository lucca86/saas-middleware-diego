"use server"

import { revalidatePath } from "next/cache"
import { createPublicClient } from "@/lib/supabase/public"
import { imageProxyUrl } from "@/lib/r2/image-url"
import {
  CART_LIMITS,
  cartCount,
  clearCart as clearCartCookie,
  readCart,
  writeCart,
  type CartLine,
} from "./cookie"

export type CartActionResult =
  | { ok: true; count: number }
  | { ok: false; error: string }

/**
 * Add a variant to the cart. We always re-fetch the variant from the DB to
 * snapshot a fresh price/name (the client can't be trusted) and to validate
 * that the variant still belongs to the tenant and is in stock.
 */
export async function addToCart(
  tenantSlug: string,
  variantId: string,
  qty = 1,
): Promise<CartActionResult> {
  const safeQty = Math.max(1, Math.min(CART_LIMITS.MAX_QTY_PER_LINE, Math.floor(qty)))
  const supabase = createPublicClient()

  // Resolve tenant + variant + product + primary image in one round-trip
  // by selecting the variant with its product joined.
  const { data, error } = await supabase
    .from("product_variants")
    .select(
      `
      id, sku, attributes, price, stock, status,
      tenants!inner(id, slug, is_storefront_published),
      products!inner(id, slug, name, status,
        product_images(storage_key, is_primary, position)
      )
      `,
    )
    .eq("id", variantId)
    .maybeSingle()

  if (error || !data) return { ok: false, error: "No encontramos el producto" }

  const tenant = Array.isArray(data.tenants) ? data.tenants[0] : data.tenants
  const product = Array.isArray(data.products) ? data.products[0] : data.products
  if (!tenant || !product) return { ok: false, error: "Producto inválido" }
  if (tenant.slug !== tenantSlug || !tenant.is_storefront_published) {
    return { ok: false, error: "Tienda no disponible" }
  }
  if (product.status !== "active" || data.status !== "active") {
    return { ok: false, error: "Producto no disponible" }
  }
  if ((data.stock ?? 0) <= 0) {
    return { ok: false, error: "Sin stock" }
  }

  const cart = await readCart(tenantSlug)
  const existing = cart.lines.find((l) => l.variantId === variantId)
  const newQty = Math.min(
    (existing?.qty ?? 0) + safeQty,
    data.stock ?? CART_LIMITS.MAX_QTY_PER_LINE,
    CART_LIMITS.MAX_QTY_PER_LINE,
  )

  const images = (product.product_images ?? []) as Array<{
    storage_key: string
    is_primary: boolean
    position: number
  }>
  const primary =
    images.find((i) => i.is_primary) ??
    [...images].sort((a, b) => a.position - b.position)[0] ??
    null
  const imageUrl = imageProxyUrl(primary?.storage_key)

  const newLine: CartLine = {
    variantId,
    productId: product.id,
    productSlug: product.slug,
    productName: product.name,
    variantSku: data.sku ?? null,
    variantAttrs: (data.attributes ?? {}) as Record<string, string>,
    unitPrice: Number(data.price),
    qty: newQty,
    imageUrl: imageUrl ?? null,
  }

  const lines = existing
    ? cart.lines.map((l) => (l.variantId === variantId ? newLine : l))
    : [...cart.lines, newLine]

  await writeCart(tenantSlug, { v: 1, lines })
  revalidatePath(`/s/${tenantSlug}`, "layout")
  return { ok: true, count: cartCount({ v: 1, lines }) }
}

export async function updateLineQty(
  tenantSlug: string,
  variantId: string,
  qty: number,
): Promise<CartActionResult> {
  const cart = await readCart(tenantSlug)
  const safe = Math.max(0, Math.min(CART_LIMITS.MAX_QTY_PER_LINE, Math.floor(qty)))
  const lines = safe === 0
    ? cart.lines.filter((l) => l.variantId !== variantId)
    : cart.lines.map((l) => (l.variantId === variantId ? { ...l, qty: safe } : l))
  await writeCart(tenantSlug, { v: 1, lines })
  revalidatePath(`/s/${tenantSlug}`, "layout")
  return { ok: true, count: cartCount({ v: 1, lines }) }
}

export async function removeLine(
  tenantSlug: string,
  variantId: string,
): Promise<CartActionResult> {
  const cart = await readCart(tenantSlug)
  const lines = cart.lines.filter((l) => l.variantId !== variantId)
  await writeCart(tenantSlug, { v: 1, lines })
  revalidatePath(`/s/${tenantSlug}`, "layout")
  return { ok: true, count: cartCount({ v: 1, lines }) }
}

export async function clearCartAction(tenantSlug: string): Promise<CartActionResult> {
  await clearCartCookie(tenantSlug)
  revalidatePath(`/s/${tenantSlug}`, "layout")
  return { ok: true, count: 0 }
}
