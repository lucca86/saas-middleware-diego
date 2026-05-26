/**
 * MercadoLibre API client with automatic token refresh.
 *
 * Key differences from TiendaNube/WooCommerce:
 * - Access tokens expire in 6 hours → must auto-refresh.
 * - Refresh tokens are single-use → each refresh generates a new pair.
 * - token_expires_at stored in sales_channels for proactive renewal.
 */

import { createServiceClient } from "@/lib/supabase/service"

// ─── Constants ─────────────────────────────────────────────────────────────────

export const ML_AUTH_BASE = "https://auth.mercadolibre.com.ar"
export const ML_API_BASE = "https://api.mercadolibre.com"

/** Refresh when less than this many ms remain on the token. */
const REFRESH_THRESHOLD_MS = 30 * 60 * 1000 // 30 minutes

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface MLTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  scope: string
  user_id: number
  refresh_token: string
}

export interface MLUserInfo {
  id: number
  nickname: string
  email: string
  country_id: string
  site_id: string
  permalink: string
}

export interface MLItem {
  id: string
  title: string
  category_id: string
  price: number
  currency_id: string
  available_quantity: number
  sold_quantity: number
  buying_mode: string
  listing_type_id: string
  condition: string
  status: string
  permalink: string
  thumbnail: string
  pictures: Array<{ id: string; url: string; secure_url: string }>
  seller_custom_field: string | null
  attributes: Array<{ id: string; name: string; value_name: string | null; value_id: string | null }>
  variations: Array<{
    id: number
    price: number
    available_quantity: number
    sold_quantity: number
    attribute_combinations: Array<{ id: string; name: string; value_name: string | null }>
    seller_custom_field: string | null
    picture_ids: string[]
  }>
  shipping: Record<string, unknown>
  tags: string[]
  date_created: string
  last_updated: string
}

export interface MLOrder {
  id: number
  status: string
  date_created: string
  date_closed: string | null
  total_amount: number
  currency_id: string
  buyer: { id: number; nickname: string; email: string | null } | null
  order_items: Array<{
    item: { id: string; title: string; seller_custom_field: string | null; variation_id: number | null }
    quantity: number
    unit_price: number
    full_unit_price: number
    currency_id: string
  }>
  shipping: { id: number | null } | null
  payments: Array<{ status: string; payment_method_id: string; total_paid_amount: number }>
}

// ─── Env helpers ───────────────────────────────────────────────────────────────

export function mlIsConfigured(): boolean {
  return true
}

function requireEnv(key: string): string {
  const val = process.env[key]
  if (!val) throw new Error(`Missing env var: ${key}`)
  return val
}

// ─── OAuth URLs ────────────────────────────────────────────────────────────────

/**
 * Build the MercadoLibre OAuth authorize URL.
 * Accepts explicit credentials so tenants can configure their own ML app
 * instead of relying on global env vars.
 */
export function buildMLAuthorizeUrl(
  state: string,
  credentials?: { appId: string },
  appUrl?: string,
): string {
  const appId = credentials?.appId ?? process.env.ML_APP_ID ?? ""
  if (!appId) throw new Error("ML App ID no configurado.")
  const baseUrl =
    appUrl ??
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")

  const url = new URL(`${ML_AUTH_BASE}/authorization`)
  url.searchParams.set("response_type", "code")
  url.searchParams.set("client_id", appId)
  url.searchParams.set("redirect_uri", `${baseUrl}/api/mercadolibre/callback`)
  url.searchParams.set("state", state)
  return url.toString()
}

/**
 * Exchange an authorization code for an access + refresh token pair.
 * Credentials can be passed explicitly (tenant-stored) or fall back to env vars.
 */
export async function exchangeMLCode(
  code: string,
  credentials?: { appId: string; clientSecret: string },
  appUrl?: string,
): Promise<MLTokenResponse> {
  const appId = credentials?.appId ?? process.env.ML_APP_ID ?? ""
  const secret = credentials?.clientSecret ?? process.env.ML_CLIENT_SECRET ?? ""
  if (!appId || !secret) throw new Error("ML credentials not configured.")
  const baseUrl =
    appUrl ??
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")

  const res = await fetch(`${ML_API_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: appId,
      client_secret: secret,
      code,
      redirect_uri: `${baseUrl}/api/mercadolibre/callback`,
    }),
    cache: "no-store",
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`ML token exchange failed ${res.status}: ${body}`)
  }
  return res.json()
}

/**
 * Refresh an expired (or nearly-expired) token.
 * Credentials can be passed explicitly (tenant-stored) or fall back to env vars.
 * IMPORTANT: refresh tokens are single-use. The new pair must be persisted
 * immediately after this call or the refresh token is lost.
 */
export async function refreshMLToken(
  refreshToken: string,
  credentials?: { appId: string; clientSecret: string },
): Promise<MLTokenResponse> {
  const appId = credentials?.appId ?? process.env.ML_APP_ID ?? ""
  const secret = credentials?.clientSecret ?? process.env.ML_CLIENT_SECRET ?? ""
  if (!appId || !secret) throw new Error("ML credentials not configured.")

  const res = await fetch(`${ML_API_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: appId,
      client_secret: secret,
      refresh_token: refreshToken,
    }),
    cache: "no-store",
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`ML token refresh failed ${res.status}: ${body}`)
  }
  return res.json()
}

// ─── Auto-refresh client ────────────────────────────────────────────────────────

/**
 * Get a valid access token for the given channel, refreshing it if needed.
 * Uses credentials stored in the channel metadata (ml_app_id / ml_client_secret)
 * so no global env vars are required at runtime.
 */
export async function getMLAccessToken(channelId: string): Promise<string> {
  const service = createServiceClient()
  const { data, error } = await service
    .from("sales_channels")
    .select("access_token, refresh_token, token_expires_at, metadata")
    .eq("id", channelId)
    .single()

  if (error || !data) throw new Error(`Canal ML no encontrado: ${channelId}`)
  if (!data.access_token) throw new Error(`Canal ML sin access_token: ${channelId}`)

  // Check if we need to refresh (< 30 min remaining or already expired)
  const expiresAt = data.token_expires_at ? new Date(data.token_expires_at).getTime() : 0
  const needsRefresh = Date.now() > expiresAt - REFRESH_THRESHOLD_MS

  if (!needsRefresh) return data.access_token as string

  // Read tenant credentials from metadata if available, fall back to env vars
  const meta = (data.metadata ?? {}) as Record<string, string>
  const credentials =
    meta.ml_app_id && meta.ml_client_secret
      ? { appId: meta.ml_app_id, clientSecret: meta.ml_client_secret }
      : undefined

  // Refresh the token
  const newTokens = await refreshMLToken(data.refresh_token as string, credentials)
  const newExpiresAt = new Date(Date.now() + newTokens.expires_in * 1000).toISOString()

  await service
    .from("sales_channels")
    .update({
      access_token: newTokens.access_token,
      refresh_token: newTokens.refresh_token,
      token_expires_at: newExpiresAt,
    })
    .eq("id", channelId)

  return newTokens.access_token
}

// ─── API helpers ────────────────────────────────────────────────────────────────

async function mlFetch<T>(
  path: string,
  channelId: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getMLAccessToken(channelId)
  const res = await fetch(`${ML_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(options.headers ?? {}),
    },
    cache: "no-store",
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`ML API ${options.method ?? "GET"} ${path}: ${res.status} — ${body}`)
  }
  return res.json()
}

// ─── User info ─────────────────────────────────────────────────────────────────

export function fetchMLUserInfo(channelId: string): Promise<MLUserInfo> {
  return mlFetch<MLUserInfo>("/users/me", channelId)
}

// ─── Items (products) ──────────────────────────────────────────────────────────

export function fetchMLItem(channelId: string, itemId: string): Promise<MLItem> {
  return mlFetch<MLItem>(`/items/${itemId}`, channelId)
}

export async function createMLItem(
  channelId: string,
  payload: Record<string, unknown>,
): Promise<MLItem> {
  return mlFetch<MLItem>("/items", channelId, {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function updateMLItem(
  channelId: string,
  itemId: string,
  payload: Record<string, unknown>,
): Promise<MLItem> {
  return mlFetch<MLItem>(`/items/${itemId}`, channelId, {
    method: "PUT",
    body: JSON.stringify(payload),
  })
}

/**
 * Upload a picture to ML from a URL. Returns the picture object with its ML id.
 */
export async function uploadMLPicture(
  channelId: string,
  src: string,
): Promise<{ id: string; url: string; secure_url: string }> {
  return mlFetch<{ id: string; url: string; secure_url: string }>(
    "/pictures/items/upload",
    channelId,
    {
      method: "POST",
      body: JSON.stringify({ source: src }),
    },
  )
}

/**
 * Get all item IDs for a seller (paginated).
 */
export async function* iterateMLSellerItems(
  channelId: string,
  userId: number,
): AsyncGenerator<string> {
  let offset = 0
  const limit = 100

  while (true) {
    const data = await mlFetch<{
      results: string[]
      paging: { total: number; offset: number; limit: number }
    }>(
      `/users/${userId}/items/search?status=active&offset=${offset}&limit=${limit}`,
      channelId,
    )

    if (!data.results?.length) break
    for (const id of data.results) yield id

    offset += data.results.length
    if (offset >= data.paging.total) break
  }
}

export function fetchMLOrder(channelId: string, orderId: string | number): Promise<MLOrder> {
  return mlFetch<MLOrder>(`/orders/${orderId}`, channelId)
}

// ─── Category helpers ──────────────────────────────────────────────────────────

export interface MLCategoryAttribute {
  id: string
  name: string
  value_type: string
  values: Array<{ id: string; name: string }> | null
  tags: Record<string, boolean>
}

export async function fetchMLCategoryAttributes(
  categoryId: string,
): Promise<MLCategoryAttribute[]> {
  const res = await fetch(`${ML_API_BASE}/categories/${categoryId}/attributes`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  })
  if (!res.ok) return []
  return res.json()
}

export async function searchMLCategories(
  query: string,
  siteId = "MLA",
): Promise<Array<{ domain_id: string; category_id: string; category_name: string }>> {
  const res = await fetch(
    `${ML_API_BASE}/sites/${siteId}/domain_discovery/search?q=${encodeURIComponent(query)}&limit=5`,
    { headers: { Accept: "application/json" }, cache: "no-store" },
  )
  if (!res.ok) return []
  return res.json()
}
