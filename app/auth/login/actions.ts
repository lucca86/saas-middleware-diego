"use server"

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

/**
 * Sign-in via Server Action.
 *
 * We do this server-side instead of calling supabase.auth.signInWithPassword
 * from the browser for two reasons:
 *
 *  1. The browser client tries to set Supabase auth cookies on the current
 *     origin. In sandboxed previews (vusercontent.net) third-party cookie
 *     restrictions can cause the cookies to silently fail, leaving the user
 *     "logged in" client-side but invisible to the server, which then
 *     bounces them back to /auth/login on the next navigation.
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
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    // Map a couple of well-known Supabase errors to friendlier copy.
    const msg =
      error.message === "Invalid login credentials"
        ? "Email o contraseña incorrectos"
        : error.message
    return { error: msg }
  }

  // Only redirect to safe internal paths to prevent open-redirect.
  const target = next.startsWith("/") && !next.startsWith("//") ? next : "/select-tenant"
  redirect(target)
}
