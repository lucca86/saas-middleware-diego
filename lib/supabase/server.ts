import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

/**
 * Cookie options forced on every Supabase auth cookie we persist.
 *
 * Why `sameSite=none` + `secure=true`?
 * The v0 preview embeds the running app inside an iframe served from a
 * different eTLD+1 (vusercontent.net) than v0.app. In that "third-party
 * context", browsers refuse to attach cookies marked `SameSite=Lax`
 * (Supabase's default) on subsequent navigations, so the user logs in
 * successfully on the server but the browser drops the cookies and
 * every link click bounces back to /auth/login.
 *
 * `SameSite=None; Secure` is the only combination that survives a
 * third-party iframe. It also works correctly in the production
 * deployment (HTTPS top-level), so we apply it unconditionally.
 *
 * CSRF: Next.js Server Actions ship with built-in origin checks; we
 * don't expose unauthenticated POST endpoints that mutate state.
 */
const COOKIE_OVERRIDES = {
  sameSite: "none",
  secure: true,
} as const

/**
 * Especially important if using Fluid compute: Don't put this client in a
 * global variable. Always create a new client within each function when using
 * it.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, { ...options, ...COOKIE_OVERRIDES }),
          )
        } catch {
          // The "setAll" method was called from a Server Component.
          // This can be ignored if you have proxy refreshing user sessions.
        }
      },
    },
  })
}
