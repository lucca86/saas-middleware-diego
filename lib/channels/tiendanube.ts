import "server-only"

/**
 * Tienda Nube OAuth + REST client.
 *
 * Docs: https://tiendanube.github.io/api-documentation/
 *
 * Auth flow (server-side):
 *   1. Redirect user to https://www.tiendanube.com/apps/{APP_ID}/authorize?state=...
 *      with state being our CSRF token (a row in channel_oauth_states).
 *   2. TN redirects back to /api/tiendanube/callback?code=...&state=...
 *   3. We POST to https://www.tiendanube.com/apps/authorize/token with
 *      { client_id, client_secret, grant_type: 'authorization_code', code }
 *      and get { access_token, token_type, scope, user_id }.
 *      `user_id` is the store_id used as the path prefix for every API call.
 *   4. Persist + use access_token as `Authentication: bearer ...` against
 *      https://api.tiendanube.com/v1/{store_id}/...
 *
 * NOTE: the TN auth header is literally "Authentication: bearer <token>"
 *       (sic, not Authorization). And every request needs a User-Agent
 *       with "AppName (contact-email)" — TN rejects anonymous clients.
 */

const AUTH_BASE = "https://www.tiendanube.com"
const API_BASE = "https://api.tiendanube.com/v1"

export interface TiendaNubeTokenResponse {
  access_token: string
  token_type: string
  scope: string
  user_id: number
}

export interface TiendaNubeStore {
  id: number
  name: Record<string, string> | string
  description?: Record<string, string> | string
  url?: string
  original_domain?: string
  country?: string
  main_currency?: string
  main_language?: string
  email?: string
  business_name?: string
  plan_name?: string
  created_at?: string
}

export class TiendaNubeError extends Error {
  status: number
  body: unknown
  constructor(message: string, status: number, body: unknown) {
    super(message)
    this.name = "TiendaNubeError"
    this.status = status
    this.body = body
  }
}

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env var ${name}`)
  return v
}

export function tiendaNubeIsConfigured(): boolean {
  return !!(process.env.TIENDANUBE_APP_ID && process.env.TIENDANUBE_CLIENT_SECRET)
}

/**
 * Build the URL the user must be redirected to so they grant access.
 *
 * TN REQUIRES the redirect_uri to be included explicitly in the authorize URL,
 * and it must match EXACTLY the one configured in the partner panel.
 * Without it, TN shows the generic platform login instead of the app auth flow.
 */
export function buildAuthorizeUrl(state: string): string {
  const appId = requireEnv("TIENDANUBE_APP_ID")
  const baseAppUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)

  const url = new URL(`${AUTH_BASE}/apps/${appId}/authorize`)
  url.searchParams.set("state", state)
  if (baseAppUrl) {
    url.searchParams.set("redirect_uri", `${baseAppUrl}/api/tiendanube/callback`)
  }
  return url.toString()
}

/**
 * Exchange the authorization code received in the callback for an
 * access_token + the store_id (returned as `user_id` by TN, which is
 * misleading but documented).
 */
export async function exchangeCodeForToken(code: string): Promise<TiendaNubeTokenResponse> {
  const appId = requireEnv("TIENDANUBE_APP_ID")
  const clientSecret = requireEnv("TIENDANUBE_CLIENT_SECRET")
  const userAgent = process.env.TIENDANUBE_APP_NAME ?? "Stockcurve (support@stockcurve.app)"

  const res = await fetch(`${AUTH_BASE}/apps/authorize/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": userAgent,
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: appId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code,
    }),
    cache: "no-store",
  })

  const text = await res.text()
  let body: unknown = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }

  if (!res.ok) {
    throw new TiendaNubeError(
      `Token exchange failed: ${res.status} ${res.statusText}`,
      res.status,
      body,
    )
  }

  return body as TiendaNubeTokenResponse
}

/**
 * Generic authenticated GET against the TN REST API. `path` is everything
 * after the store id, e.g. "/store" or "/products?per_page=50".
 */
export async function tiendaNubeGet<T>(
  storeId: string | number,
  path: string,
  accessToken: string,
): Promise<T> {
  const userAgent = process.env.TIENDANUBE_APP_NAME ?? "Stockcurve (support@stockcurve.app)"
  const url = `${API_BASE}/${storeId}${path.startsWith("/") ? path : `/${path}`}`

  const res = await fetch(url, {
    headers: {
      Authentication: `bearer ${accessToken}`,
      "User-Agent": userAgent,
      Accept: "application/json",
    },
    cache: "no-store",
  })

  const text = await res.text()
  let body: unknown = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }

  if (!res.ok) {
    throw new TiendaNubeError(
      `TN API ${res.status} on ${path}`,
      res.status,
      body,
    )
  }

  return body as T
}

export function fetchStore(storeId: string | number, accessToken: string) {
  return tiendaNubeGet<TiendaNubeStore>(storeId, "/store", accessToken)
}

/** Pick a string out of TN's localized fields. */
export function pickLocalized(value: Record<string, string> | string | undefined, lang = "es"): string {
  if (!value) return ""
  if (typeof value === "string") return value
  return value[lang] ?? value.es ?? value.en ?? Object.values(value)[0] ?? ""
}

// ─── Product types ─────────────────────────────────────────────────────────────

export interface TiendaNubeVariantValue {
  id: number
  name: string
  slug?: string
}

export interface TiendaNubeVariant {
  id: number
  product_id: number
  price: string
  compare_at_price: string | null
  promotional_price: string | null
  stock_management: boolean
  stock: number | null
  sku: string | null
  barcode: string | null
  weight: string | null
  depth: string | null
  height: string | null
  width: string | null
  values: TiendaNubeVariantValue[]
  image_id: number | null
  created_at: string
  updated_at: string
  inventory_levels?: Array<{ id: number; variant_id: number; location_id: number; stock: number }>
}

export interface TiendaNubeImage {
  id: number
  product_id: number
  src: string
  position: number
  alt: Record<string, string> | null
  created_at: string
  updated_at: string
}

export interface TiendaNubeAttribute {
  id: number
  name: Record<string, string>
  values: Array<{ id: number; name: Record<string, string> }>
}

export interface TiendaNubeProduct {
  id: number
  name: Record<string, string> | string
  description: Record<string, string> | string | null
  handle: Record<string, string> | string | null
  variants: TiendaNubeVariant[]
  images: TiendaNubeImage[]
  attributes: TiendaNubeAttribute[]
  categories: Array<{ id: number; name: Record<string, string> }>
  brand: string | null
  seo_title: Record<string, string> | string | null
  published: boolean
  free_shipping: boolean
  requires_shipping: boolean
  canonical_url: string | null
  tags: string
  created_at: string
  updated_at: string
}

export interface TiendaNubeProductsResponse {
  data: TiendaNubeProduct[]
  total: number
}

/**
 * Paginated product fetch. TN uses `Link: <...>; rel="next"` headers or
 * `x-total-count` / `x-total-pages`. We iterate by page until exhausted.
 */
export async function* iterateTiendaNubeProducts(
  storeId: string | number,
  accessToken: string,
  perPage = 200,
): AsyncGenerator<TiendaNubeProduct> {
  const userAgent = process.env.TIENDANUBE_APP_NAME ?? "Stockcurve (support@stockcurve.app)"
  let page = 1

  while (true) {
    const url = `${API_BASE}/${storeId}/products?per_page=${perPage}&page=${page}&fields=id,name,description,handle,variants,images,attributes,categories,brand,published,tags,created_at,updated_at`
    const res = await fetch(url, {
      headers: {
        Authentication: `bearer ${accessToken}`,
        "User-Agent": userAgent,
        Accept: "application/json",
      },
      cache: "no-store",
    })

    if (!res.ok) {
      const body = await res.text()
      throw new TiendaNubeError(`GET /products page ${page}: ${res.status}`, res.status, body)
    }

    const products: TiendaNubeProduct[] = await res.json()
    if (!Array.isArray(products) || products.length === 0) break

    for (const p of products) yield p

    // TN returns fewer items than perPage when on the last page.
    if (products.length < perPage) break
    page++
  }
}

/**
 * Get total product count for progress calculation.
 * Uses `x-total-count` header from a HEAD request or first page fetch.
 */
export async function getTiendaNubeProductCount(
  storeId: string | number,
  accessToken: string,
): Promise<number> {
  const userAgent = process.env.TIENDANUBE_APP_NAME ?? "Stockcurve (support@stockcurve.app)"
  const url = `${API_BASE}/${storeId}/products?per_page=1&page=1`
  const res = await fetch(url, {
    headers: {
      Authentication: `bearer ${accessToken}`,
      "User-Agent": userAgent,
      Accept: "application/json",
    },
    cache: "no-store",
  })
  if (!res.ok) return 0
  const total = res.headers.get("x-total-count")
  if (total) return parseInt(total, 10)
  // Fallback: count from body
  const body: TiendaNubeProduct[] = await res.json()
  return body.length
}

// ─── Mutation helpers (Sprint C) ───────────────────────────────────────────────

/** Update top-level product fields. */
export async function updateTiendaNubeProduct(
  storeId: string | number,
  productId: number,
  accessToken: string,
  data: Record<string, unknown>,
): Promise<void> {
  const userAgent = process.env.TIENDANUBE_APP_NAME ?? "Stockcurve (support@stockcurve.app)"
  const url = `${API_BASE}/${storeId}/products/${productId}`
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authentication: `bearer ${accessToken}`,
      "User-Agent": userAgent,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(data),
    cache: "no-store",
  })
  if (!res.ok) {
    const body = await res.text()
    throw new TiendaNubeError(`PUT /products/${productId}: ${res.status}`, res.status, body)
  }
}

/** Update a specific variant (price, SKU, stock). */
export async function updateTiendaNubeVariant(
  storeId: string | number,
  productId: number,
  variantId: number,
  accessToken: string,
  data: Record<string, unknown>,
): Promise<void> {
  const userAgent = process.env.TIENDANUBE_APP_NAME ?? "Stockcurve (support@stockcurve.app)"
  const url = `${API_BASE}/${storeId}/products/${productId}/variants/${variantId}`
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authentication: `bearer ${accessToken}`,
      "User-Agent": userAgent,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(data),
    cache: "no-store",
  })
  if (!res.ok) {
    const body = await res.text()
    throw new TiendaNubeError(
      `PUT /products/${productId}/variants/${variantId}: ${res.status}`,
      res.status,
      body,
    )
  }
}

/**
 * Create a new product in TiendaNube.
 * Returns the created product with its variants (needed to store mappings).
 * NOTE: images are NOT accepted in this payload — use addTiendaNubeProductImage after creation.
 */
export async function createTiendaNubeProduct(
  storeId: string | number,
  accessToken: string,
  data: Record<string, unknown>,
): Promise<TiendaNubeProduct> {
  const userAgent = process.env.TIENDANUBE_APP_NAME ?? "Stockcurve (support@stockcurve.app)"
  // Strip images key — TN ignores it on creation and it can cause 422.
  const { images: _ignored, ...payload } = data as Record<string, unknown> & { images?: unknown }
  const res = await fetch(`${API_BASE}/${storeId}/products`, {
    method: "POST",
    headers: {
      Authentication: `bearer ${accessToken}`,
      "User-Agent": userAgent,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  })
  if (!res.ok) {
    const body = await res.text()
    throw new TiendaNubeError(`POST /products: ${res.status}`, res.status, body)
  }
  return res.json()
}

/**
 * Upload a single image to a TN product via POST /products/{id}/images.
 * This is the only supported way to add images — images are not accepted
 * in the product creation or update payload.
 */
export async function addTiendaNubeProductImage(
  storeId: string | number,
  productId: number,
  accessToken: string,
  src: string,
  position?: number,
): Promise<{ id: number; src: string; position: number }> {
  const userAgent = process.env.TIENDANUBE_APP_NAME ?? "Stockcurve (support@stockcurve.app)"
  const body: Record<string, unknown> = { src }
  if (position !== undefined) body.position = position
  const res = await fetch(`${API_BASE}/${storeId}/products/${productId}/images`, {
    method: "POST",
    headers: {
      Authentication: `bearer ${accessToken}`,
      "User-Agent": userAgent,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  })
  if (!res.ok) {
    const text = await res.text()
    throw new TiendaNubeError(
      `POST /products/${productId}/images: ${res.status}`,
      res.status,
      text,
    )
  }
  return res.json()
}

/**
 * List existing images for a TN product.
 */
export async function listTiendaNubeProductImages(
  storeId: string | number,
  productId: number,
  accessToken: string,
): Promise<Array<{ id: number; src: string; position: number }>> {
  const userAgent = process.env.TIENDANUBE_APP_NAME ?? "Stockcurve (support@stockcurve.app)"
  const res = await fetch(`${API_BASE}/${storeId}/products/${productId}/images`, {
    headers: {
      Authentication: `bearer ${accessToken}`,
      "User-Agent": userAgent,
      Accept: "application/json",
    },
    cache: "no-store",
  })
  if (!res.ok) return []
  return res.json()
}

/** Register a webhook on the store. */
export async function registerTiendaNubeWebhook(
  storeId: string | number,
  accessToken: string,
  event: string,
  url: string,
): Promise<{ id: number }> {
  const userAgent = process.env.TIENDANUBE_APP_NAME ?? "Stockcurve (support@stockcurve.app)"
  const res = await fetch(`${API_BASE}/${storeId}/webhooks`, {
    method: "POST",
    headers: {
      Authentication: `bearer ${accessToken}`,
      "User-Agent": userAgent,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ event, url }),
    cache: "no-store",
  })
  if (!res.ok) {
    const body = await res.text()
    throw new TiendaNubeError(`POST /webhooks (${event}): ${res.status}`, res.status, body)
  }
  return res.json()
}

/** List existing webhooks. */
export async function listTiendaNubeWebhooks(
  storeId: string | number,
  accessToken: string,
): Promise<Array<{ id: number; event: string; url: string }>> {
  const userAgent = process.env.TIENDANUBE_APP_NAME ?? "Stockcurve (support@stockcurve.app)"
  const res = await fetch(`${API_BASE}/${storeId}/webhooks`, {
    headers: {
      Authentication: `bearer ${accessToken}`,
      "User-Agent": userAgent,
      Accept: "application/json",
    },
    cache: "no-store",
  })
  if (!res.ok) return []
  return res.json()
}
