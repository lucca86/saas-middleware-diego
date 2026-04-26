import "server-only"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"

/**
 * Server-only Supabase client that uses the service role key.
 *
 * Bypasses RLS — only call this from code paths that have already validated
 * the caller has the right to do whatever they're about to do (e.g. behind
 * `requirePlatformAdmin()`).
 */
export function createServiceClient() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no están configurados")
  }
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
