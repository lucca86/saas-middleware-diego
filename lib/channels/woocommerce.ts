import "server-only"

/**
 * WooCommerce REST API client.
 *
 * Unlike Tienda Nube, WooCommerce doesn't use OAuth. The store admin
 * generates a Consumer Key / Consumer Secret pair manually under
 * `WP Admin → WooCommerce → Settings → Advanced → REST API`. We use those
 * via HTTP Basic auth on every request.
 *
 * Each tenant points to their own self-hosted store URL, so the base URL
 * is dynamic per channel. We always target the v3 namespace.
 */

export interface WooCredentials {
  storeUrl: string // e.g. "https://mitienda.com"
  consumerKey: string // ck_xxxx
  consumerSecret: string // cs_xxxx
}

/** Subset of WC product fields we read during import. */
export interface WooProduct {
  id: number
  name: string
  slug: string
  permalink: string
  type: "simple" | "variable" | "grouped" | "external"
  status: "publish" | "draft" | "private" | "pending"
  description: string
  short_description: string
  sku: string
  price: string
  regular_price: string
  sale_price: string
  manage_stock: boolean
  stock_quantity: number | null
  stock_status: "instock" | "outofstock" | "onbackorder"
  weight: string
  categories: { id: number; name: string; slug: string }[]
  tags: { id: number; name: string; slug: string }[]
  images: { id: number; src: string; name: string; alt: string }[]
  attributes: WooAttribute[]
  variations: number[]
  default_attributes: { id: number; name: string; option: string }[]
}

export interface WooAttribute {
  id: number
  name: string
  position: number
  visible: boolean
  variation: boolean
  options: string[]
}

export interface WooVariation {
  id: number
  sku: string
  price: string
  regular_price: string
  sale_price: string
  manage_stock: boolean
  stock_quantity: number | null
  stock_status: "instock" | "outofstock" | "onbackorder"
  weight: string
  image: { id: number; src: string; name: string; alt: string } | null
  attributes: { id: number; name: string; option: string }[]
}

/** Minimal store info to confirm the credentials work. */
export interface WooStoreInfo {
  name: string
  url: string
  currency: string | null
  country: string | null
}

function normalizeStoreUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "")
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error(`URL inválida: ${raw}. Debe incluir https:// o http://`)
  }
  return trimmed
}

function authHeader(creds: WooCredentials): string {
  // WC accepts Basic auth with consumer_key:consumer_secret as
  // username:password. We must not pass them as query parameters because
  // some WAFs strip ck/cs in logs and proxies.
  const token = Buffer.from(`${creds.consumerKey}:${creds.consumerSecret}`).toString("base64")
  return `Basic ${token}`
}

async function wcRequest<T>(
  creds: WooCredentials,
  path: string,
  init: RequestInit = {},
): Promise<{ data: T; headers: Headers }> {
  const base = normalizeStoreUrl(creds.storeUrl)
  const url = `${base}/wp-json/wc/v3${path}`

  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: authHeader(creds),
      ...(init.headers ?? {}),
    },
    // Avoid Next caching API responses across requests
    cache: "no-store",
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    let message = `WooCommerce respondió ${res.status}`
    try {
      const json = JSON.parse(text)
      if (json?.message) message = `${message}: ${json.message}`
    } catch {
      if (text) message = `${message}: ${text.slice(0, 200)}`
    }
    throw new Error(message)
  }

  const data = (await res.json()) as T
  return { data, headers: res.headers }
}

/**
 * Validates credentials by hitting the system_status endpoint. Returns a
 * minimal description we cache in `sales_channels` for display.
 */
export async function fetchStoreInfo(creds: WooCredentials): Promise<WooStoreInfo> {
  // /system_status is the most reliable identity probe; it requires
  // read auth and returns environment + settings without listing data.
  const { data } = await wcRequest<{
    settings: { currency: string; currency_symbol: string }
    environment: { site_url: string; home_url: string; version: string }
  }>(creds, "/system_status")

  const url = data.environment?.home_url ?? data.environment?.site_url ?? normalizeStoreUrl(creds.storeUrl)
  const name = (() => {
    try {
      return new URL(url).hostname.replace(/^www\./, "")
    } catch {
      return url
    }
  })()

  return {
    name,
    url,
    currency: data.settings?.currency ?? null,
    country: null, // WC doesn't expose store country reliably via REST.
  }
}

const PER_PAGE = 50

/**
 * List all products via paginated calls. Pulls everything (publish + draft +
 * private + pending) so the tenant can decide later what to keep visible.
 *
 * The async generator yields one product at a time so the importer can
 * stream-write to Supabase without holding the entire catalog in memory.
 */
export async function* iterateProducts(creds: WooCredentials): AsyncGenerator<WooProduct, void> {
  let page = 1
  while (true) {
    const { data, headers } = await wcRequest<WooProduct[]>(
      creds,
      `/products?per_page=${PER_PAGE}&page=${page}&status=any`,
    )
    for (const p of data) yield p
    const totalPages = Number.parseInt(headers.get("x-wp-totalpages") ?? "1", 10)
    if (page >= totalPages) return
    page += 1
  }
}

export async function fetchVariations(
  creds: WooCredentials,
  productId: number,
): Promise<WooVariation[]> {
  // Variations live on a sub-resource. Even with hundreds we paginate with
  // PER_PAGE; very few products have >50 variations in practice.
  const all: WooVariation[] = []
  let page = 1
  while (true) {
    const { data, headers } = await wcRequest<WooVariation[]>(
      creds,
      `/products/${productId}/variations?per_page=${PER_PAGE}&page=${page}`,
    )
    all.push(...data)
    const totalPages = Number.parseInt(headers.get("x-wp-totalpages") ?? "1", 10)
    if (page >= totalPages) break
    page += 1
  }
  return all
}

export function wooIsValidStoreUrl(raw: string): boolean {
  try {
    normalizeStoreUrl(raw)
    return true
  } catch {
    return false
  }
}
