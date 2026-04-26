/**
 * Build a same-origin URL for an image stored in R2 by its storage key.
 *
 * All product images are served through `/api/images/<storage_key>` instead of
 * the direct R2 public URL. This avoids browser CORS errors against
 * `*.r2.dev` (which doesn't send `Access-Control-Allow-Origin`) for any tool
 * that runs `fetch()` against image assets, including v0's preview snapshot
 * tool, screenshot services, and oEmbed crawlers.
 *
 * Safe to import from both server and client code.
 */
export function imageProxyUrl(storageKey: string | null | undefined): string | null {
  if (!storageKey) return null
  // Strip any leading slash so the URL stays canonical regardless of how the
  // key was stored.
  const key = storageKey.replace(/^\/+/, "")
  return `/api/images/${key}`
}
