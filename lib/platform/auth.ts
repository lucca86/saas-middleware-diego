import "server-only"
import { redirect } from "next/navigation"
import { getCurrentUser, getIsPlatformAdmin } from "@/lib/auth/current-user"

/**
 * Returns true if the currently authenticated user is registered in the
 * `platform_admins` table. Resolved via the cached getIsPlatformAdmin so
 * sidebar, layout and page share one call per render.
 */
export async function isPlatformAdmin(): Promise<boolean> {
  return getIsPlatformAdmin()
}

/** Redirects to /auth/login if not signed in, or to / if signed in but not a platform admin. */
export async function requirePlatformAdmin() {
  const user = await getCurrentUser()
  if (!user) redirect("/auth/login")

  const ok = await getIsPlatformAdmin()
  if (!ok) redirect("/")
  return user
}
