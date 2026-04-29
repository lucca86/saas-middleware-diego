import "server-only"
import { cache } from "react"
import { createClient } from "@/lib/supabase/server"

/**
 * Single source of truth for "who is the current user" inside an RSC tree.
 *
 * `cache()` dedupes within a single React render, so calling this from the
 * tenant layout, the page, and a deep component triggers exactly ONE
 * /auth/v1/user request to Supabase.
 *
 * IMPORTANT: every helper that needs the user (requireTenant, isPlatformAdmin,
 * listUserTenants, getCurrentUserProfile, etc.) MUST go through this — never
 * call `supabase.auth.getUser()` directly inside RSC code or you reintroduce
 * the duplicate-call problem we just removed.
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
})

/**
 * Same idea for the platform-admin check. Cached for the whole render so
 * sidebar, layout and page reuse a single RPC call.
 */
export const getIsPlatformAdmin = cache(async (): Promise<boolean> => {
  const user = await getCurrentUser()
  if (!user) return false
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("is_platform_admin")
  if (error) return false
  return Boolean(data)
})
