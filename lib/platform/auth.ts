import "server-only"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

/**
 * Returns true if the currently authenticated user is registered in the
 * `platform_admins` table. Resolves the value via the `is_platform_admin()`
 * SQL helper so RLS keeps working consistently.
 */
export async function isPlatformAdmin(): Promise<boolean> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return false

  const { data, error } = await supabase.rpc("is_platform_admin")
  if (error) return false
  return Boolean(data)
}

/** Redirects to /auth/login if not signed in, or to / if signed in but not a platform admin. */
export async function requirePlatformAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data } = await supabase.rpc("is_platform_admin")
  if (!data) redirect("/")
  return user
}
