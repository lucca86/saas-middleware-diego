import "server-only"
import { cookies } from "next/headers"
import { z } from "zod"

/**
 * Cart persistence layer.
 *
 * The cart lives in an HTTP-only cookie scoped per tenant slug:
 *   sc_cart_<slug> = "<base64url(JSON)>"
 *
 * We don't share carts across tenants (a customer browsing two storefronts
 * has two independent carts) and we don't authenticate the cart user — it
 * is anonymous until checkout.
 *
 * The shape is intentionally minimal: only IDs + qty + the snapshot data
 * we need to render the cart UI without re-querying the server. At
 * checkout time we re-fetch each variant from the DB to recompute prices
 * and validate stock, so price tampering on the client doesn't matter.
 */

const CART_COOKIE_PREFIX = "sc_cart_"
const MAX_QTY_PER_LINE = 50

const CartLineSchema = z.object({
  variantId: z.string().uuid(),
  productId: z.string().uuid(),
  productSlug: z.string(),
  productName: z.string(),
  variantSku: z.string().nullable().optional(),
  variantAttrs: z.record(z.string()).default({}),
  unitPrice: z.number().nonnegative(),
  qty: z.number().int().positive().max(MAX_QTY_PER_LINE),
  imageUrl: z.string().nullable().optional(),
})

const CartSchema = z.object({
  v: z.literal(1),
  lines: z.array(CartLineSchema).max(50),
})

export type CartLine = z.infer<typeof CartLineSchema>
export type Cart = z.infer<typeof CartSchema>

const EMPTY_CART: Cart = { v: 1, lines: [] }

function cookieName(tenantSlug: string): string {
  return `${CART_COOKIE_PREFIX}${tenantSlug}`
}

/** Read the cart for a tenant. Returns an empty cart on any failure. */
export async function readCart(tenantSlug: string): Promise<Cart> {
  const store = await cookies()
  const raw = store.get(cookieName(tenantSlug))?.value
  if (!raw) return EMPTY_CART
  try {
    const json = JSON.parse(Buffer.from(raw, "base64url").toString("utf-8"))
    return CartSchema.parse(json)
  } catch {
    // Corrupt or stale shape — start fresh.
    return EMPTY_CART
  }
}

/** Write the cart back as a base64-encoded cookie. */
export async function writeCart(tenantSlug: string, cart: Cart): Promise<void> {
  const store = await cookies()
  const value = Buffer.from(JSON.stringify(cart), "utf-8").toString("base64url")
  store.set(cookieName(tenantSlug), value, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    // 7 days is enough for the typical "abandoned cart" use case.
    maxAge: 60 * 60 * 24 * 7,
  })
}

export async function clearCart(tenantSlug: string): Promise<void> {
  const store = await cookies()
  store.delete(cookieName(tenantSlug))
}

/** Sum the line totals of a cart. */
export function cartSubtotal(cart: Cart): number {
  return cart.lines.reduce((acc, l) => acc + l.unitPrice * l.qty, 0)
}

export function cartCount(cart: Cart): number {
  return cart.lines.reduce((acc, l) => acc + l.qty, 0)
}

export const CART_LIMITS = { MAX_QTY_PER_LINE }
