import "server-only"
import { Resend } from "resend"

/**
 * Lazy singleton Resend client.
 *
 * - Returns null when `RESEND_API_KEY` is not set, so the app keeps working
 *   in environments without email (local dev, previews without secrets).
 * - We import `resend` lazily so the bundle doesn't grow when unused.
 */
let _client: Resend | null | undefined

export function getResend(): Resend | null {
  if (_client !== undefined) return _client
  const key = process.env.RESEND_API_KEY
  if (!key) {
    _client = null
    return _client
  }
  _client = new Resend(key)
  return _client
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY)
}
