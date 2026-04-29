import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

/**
 * Cookie overrides — see `lib/supabase/server.ts` for the rationale. In
 * short: SameSite=None+Secure is required for the v0 preview iframe and
 * doesn't hurt production.
 */
const COOKIE_OVERRIDES = {
  sameSite: "none",
  secure: true,
} as const

/**
 * Refreshes the Supabase session, validates tenant membership for /[tenant]/*
 * paths, and redirects unauthenticated users to /auth/login when hitting app
 * routes.
 *
 * Path-based multitenancy model:
 *   - /auth/*                      -> public
 *   - /store/[slug]/*              -> public (storefront)
 *   - /                            -> public marketing page
 *   - /onboarding                  -> authenticated, no tenant required
 *   - /select-tenant               -> authenticated, no tenant required
 *   - /app/[tenant]/*              -> authenticated AND tenant member
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, { ...options, ...COOKIE_OVERRIDES }),
          )
        },
      },
    },
  )

  // Do not run code between createServerClient and supabase.auth.getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  const isPublicRoute =
    pathname === "/" ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/store") ||
    pathname === "/s" ||
    pathname.startsWith("/s/") ||
    pathname.startsWith("/invitations") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/public")

  const isAuthedNoTenantRoute = pathname.startsWith("/onboarding") || pathname.startsWith("/select-tenant")

  const isAppRoute = pathname.startsWith("/app/")

  /**
   * Helper: build a redirect response that PRESERVES the cookies Supabase
   * just refreshed. The default `NextResponse.redirect(url)` returns a
   * brand-new response with no cookies, which means every redirect would
   * silently drop the rotated access/refresh tokens and the user would
   * see "logged out" right after a redirect. We copy the cookies from
   * `supabaseResponse` (which was rebuilt inside `setAll` above) onto
   * the redirect response.
   */
  function redirectWithCookies(url: URL) {
    const res = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach((c) => {
      res.cookies.set(c.name, c.value, {
        path: c.path,
        domain: c.domain,
        expires: c.expires,
        httpOnly: c.httpOnly,
        maxAge: c.maxAge,
        sameSite: "none",
        secure: true,
      })
    })
    return res
  }

  // Unauthenticated user trying to access protected routes
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = "/auth/login"
    url.searchParams.set("next", pathname)
    return redirectWithCookies(url)
  }

  // Authenticated user on /app/[tenant]/* -> validate membership
  if (user && isAppRoute) {
    const match = pathname.match(/^\/app\/([^/]+)/)
    const tenantSlug = match?.[1]

    if (tenantSlug) {
      const { data: membership } = await supabase
        .from("tenant_members")
        .select("role, tenants!inner(id, slug)")
        .eq("tenants.slug", tenantSlug)
        .eq("user_id", user.id)
        .maybeSingle()

      if (!membership) {
        const url = request.nextUrl.clone()
        url.pathname = "/select-tenant"
        // Generic flag — never echo the slug, see lib/tenant/context.ts.
        url.searchParams.set("denied", "1")
        return redirectWithCookies(url)
      }

      // Propagate tenant context via headers for downstream RSCs
      supabaseResponse.headers.set("x-tenant-slug", tenantSlug)
      supabaseResponse.headers.set("x-tenant-role", membership.role)
    }
  }

  // Authenticated user landing on /auth/* -> send to tenant selector
  if (user && pathname.startsWith("/auth") && !pathname.startsWith("/auth/callback") && !isAuthedNoTenantRoute) {
    const url = request.nextUrl.clone()
    url.pathname = "/select-tenant"
    return redirectWithCookies(url)
  }

  return supabaseResponse
}
