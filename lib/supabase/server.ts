import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

/**
 * Cookie options forced on every Supabase auth cookie we persist.
 *
 * Why `sameSite=none` + `secure=true`?
 * Algunos entornos embeben la app dentro de un iframe desde un dominio
 * distinto. En ese contexto, los browsers rechazan cookies `SameSite=Lax`
 * (el default de Supabase) en navegaciones subsiguientes.
 *
 * `SameSite=None; Secure` es la única combinación que funciona en ese
 * escenario y también en producción (HTTPS top-level).
 *
 * CSRF: Next.js Server Actions incluyen origin checks built-in; no
 * exponemos endpoints POST sin autenticación que muten estado.
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
