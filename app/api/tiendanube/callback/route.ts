import { NextResponse, type NextRequest } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"
import {
  exchangeCodeForToken,
  fetchStore,
  pickLocalized,
  tiendaNubeIsConfigured,
} from "@/lib/channels/tiendanube"

export const runtime = "nodejs"

/**
 * Tienda Nube OAuth callback.
 *
 * Sequence:
 *   1. Validate `code` + `state` query params.
 *   2. Look up the state row to recover (tenant_id, user_id).
 *   3. Exchange the code for an access_token + store_id.
 *   4. Fetch /store to enrich the row (display name, url, currency...).
 *   5. Upsert into sales_channels keyed by (tenant_id, 'tiendanube', external_id).
 *   6. Delete the consumed state row and redirect to the channel page.
 *
 * Errors are reported by redirecting to /channels?error=... so the user
 * gets visible feedback instead of a JSON blob.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  const errorParam = url.searchParams.get("error")

  if (!tiendaNubeIsConfigured()) {
    return NextResponse.redirect(new URL("/?error=tn_not_configured", url.origin))
  }

  if (errorParam) {
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent(errorParam)}`, url.origin),
    )
  }
  if (!code || !state) {
    return NextResponse.redirect(new URL("/?error=missing_code_or_state", url.origin))
  }

  const service = createServiceClient()

  // 1. Resolve the state -> (tenant, user). We use the service client so we
  //    can read the locked-down channel_oauth_states table.
  const { data: stateRow, error: stateErr } = await service
    .from("channel_oauth_states")
    .select("state, tenant_id, provider, user_id, expires_at")
    .eq("state", state)
    .maybeSingle()

  if (stateErr || !stateRow) {
    return NextResponse.redirect(new URL("/?error=invalid_state", url.origin))
  }
  if (new Date(stateRow.expires_at).getTime() < Date.now()) {
    await service.from("channel_oauth_states").delete().eq("state", state)
    return NextResponse.redirect(new URL("/?error=state_expired", url.origin))
  }

  // 2. Find the tenant slug so we can redirect back into the app.
  const { data: tenant } = await service
    .from("tenants")
    .select("slug")
    .eq("id", stateRow.tenant_id)
    .maybeSingle()
  const tenantSlug = tenant?.slug ?? null

  function fail(reason: string) {
    const target = tenantSlug
      ? `/app/${tenantSlug}/channels?error=${encodeURIComponent(reason)}`
      : `/?error=${encodeURIComponent(reason)}`
    return NextResponse.redirect(new URL(target, url.origin))
  }

  try {
    // 3. Exchange the code.
    const token = await exchangeCodeForToken(code)
    const externalId = String(token.user_id)

    // 4. Fetch the store profile to populate display fields.
    let displayName: string | null = null
    let storeUrl: string | null = null
    let country: string | null = null
    let currency: string | null = null
    let metadata: Record<string, unknown> = {}
    try {
      const store = await fetchStore(externalId, token.access_token)
      displayName = pickLocalized(store.name) || `Tienda ${externalId}`
      storeUrl = store.url ?? store.original_domain ?? null
      country = store.country ?? null
      currency = store.main_currency ?? null
      metadata = store as Record<string, unknown>
    } catch {
      // Don't block the install if /store fails — we still have a usable
      // token. The user can hit "Probar conexión" later.
      displayName = `Tienda ${externalId}`
    }

    // 5. Upsert the channel row.
    const { data: upserted, error: upsertErr } = await service
      .from("sales_channels")
      .upsert(
        {
          tenant_id: stateRow.tenant_id,
          provider: "tiendanube",
          external_id: externalId,
          display_name: displayName,
          store_url: storeUrl,
          country,
          currency,
          access_token: token.access_token,
          scopes: token.scope ? token.scope.split(",").map((s) => s.trim()) : null,
          metadata,
          status: "connected",
          last_error: null,
          connected_at: new Date().toISOString(),
          last_synced_at: new Date().toISOString(),
          created_by: stateRow.user_id,
        },
        { onConflict: "tenant_id,provider,external_id" },
      )
      .select("id")
      .single()

    if (upsertErr) return fail(`db_${upsertErr.code ?? "error"}`)

    // 6. Burn the state.
    await service.from("channel_oauth_states").delete().eq("state", state)

    return NextResponse.redirect(
      new URL(`/app/${tenantSlug}/channels/${upserted.id}?connected=1`, url.origin),
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return fail(message)
  }
}
