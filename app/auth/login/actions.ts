"use server"

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

/**
 * Sign-in via Server Action.
 *
 * We do this server-side instead of calling supabase.auth.signInWithPassword
 * from the browser for two reasons:
 *
 *  1. El browser client intenta setear las cookies de Supabase en el origen
 *     actual. En entornos con restricciones de third-party cookies las cookies
 *     pueden fallar silenciosamente, dejando al usuario "logueado" client-side
 *     pero invisible para el servidor, que lo redirige de vuelta a /auth/login.
 *  2. Server actions give us a deterministic redirect after the cookies are
 *     attached to the response, instead of relying on router.push +
 *     router.refresh which races with cookie propagation.
 *
 * On error we throw — the action is wrapped in a transition on the client,
 * which surfaces the message via useFormState/useActionState.
 */
export async function signInAction(_: unknown, formData: FormData): Promise<{ error: string } | void> {
  const email = String(formData.get("email") ?? "").trim()
  const password = String(formData.get("password") ?? "")
  const next = String(formData.get("next") ?? "") || "/select-tenant"

  if (!email || !password) {
    return { error: "Email y contraseña son obligatorios" }
  }

  const supabase = await createClient()
  console.log("[sc] login attempt:", email)
  const { error, data } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    console.log("[sc] login error:", error.message)
    // Map a couple of well-known Supabase errors to friendlier copy.
    const msg =
      error.message === "Invalid login credentials"
        ? "Email o contraseña incorrectos"
        : error.message
    return { error: msg }
  }
  console.log("[sc] login ok, user:", data.user?.id)

  // Only redirect to safe internal paths to prevent open-redirect.
  const target = next.startsWith("/") && !next.startsWith("//") ? next : "/select-tenant"
  redirect(target)
}
