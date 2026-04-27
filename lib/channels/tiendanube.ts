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
 * Build the URL the user must be redirected to so they grant access. The
 * state is opaque from TN's side — we store it server-side mapped to the
 * (tenant, user) pair so we can resume the flow on the callback.
 */
export function buildAuthorizeUrl(state: string): string {
  const appId = requireEnv("TIENDANUBE_APP_ID")
  const url = new URL(`${AUTH_BASE}/apps/${appId}/authorize`)
  url.searchParams.set("state", state)
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
