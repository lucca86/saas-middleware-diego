import "server-only"
import { headers } from "next/headers"

/**
 * Resolve the absolute base URL of the current deployment from the inbound
 * request headers. Works in dev, preview and production without any extra
 * env vars: we trust the proxy headers Vercel injects on every request.
 *
 * Falls back to NEXT_PUBLIC_APP_URL or VERCEL_URL only if headers() isn't
 * available (e.g. during static analysis).
 */
export async function getRequestBaseUrl(): Promise<string> {
  try {
    const h = await headers()
    const host = h.get("x-forwarded-host") ?? h.get("host")
    const proto = h.get("x-forwarded-proto") ?? "https"
    if (host) return `${proto}://${host}`
  } catch {
    // headers() may throw outside of a request scope.
  }
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return "http://localhost:3000"
}
