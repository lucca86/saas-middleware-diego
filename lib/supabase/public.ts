import "server-only"
import { createServerClient } from "@supabase/ssr"

/**
 * Anonymous Supabase client for the public storefront.
 *
 * Crucially this client does NOT read or write cookies, so the request always
 * runs under the `anon` Postgres role regardless of whether the visitor is
 * logged into the admin panel. That guarantees the public RLS policies
 * (which target `to anon`) are the ones that decide what's visible.
 */
export function createPublicClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return []
        },
        setAll() {
          // no-op: this client must never persist sessions.
        },
      },
    },
  )
}
