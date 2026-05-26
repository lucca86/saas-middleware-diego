import { NextResponse, type NextRequest } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"
import { exchangeMLCode, fetchMLUserInfo } from "@/lib/channels/mercadolibre"

export const runtime = "nodejs"

/**
 * MercadoLibre OAuth callback.
 *
 * Sequence:
 *   1. Validate code + state params.
 *   2. Look up state row to recover (tenant_id, user_id, ml credentials).
 *   3. Exchange code for access_token + refresh_token using tenant credentials.
 *   4. Fetch /users/me to get user_id, nickname, site_id.
 *   5. Upsert into sales_channels (storing ml_app_id + ml_client_secret in metadata).
 *   6. Burn the state row and redirect to the channel page.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  const errorParam = url.searchParams.get("error")

  if (errorParam) {
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent(errorParam)}`, url.origin),
    )
  }
  if (!code || !state) {
    return NextResponse.redirect(new URL("/?error=missing_code_or_state", url.origin))
  }

  const service = createServiceClient()

  const { data: stateRow, error: stateErr } = await service
    .from("channel_oauth_states")
    .select("state, tenant_id, provider, user_id, expires_at, metadata")
    .eq("state", state)
    .maybeSingle()

  if (stateErr || !stateRow) {
    return NextResponse.redirect(new URL("/?error=invalid_state", url.origin))
  }
  if (new Date(stateRow.expires_at).getTime() < Date.now()) {
    await service.from("channel_oauth_states").delete().eq("state", state)
    return NextResponse.redirect(new URL("/?error=state_expired", url.origin))
  }

  // Extract tenant-provided credentials stored in the state metadata
  const stateMeta = (stateRow.metadata ?? {}) as Record<string, string>
  const mlAppId = stateMeta.ml_app_id ?? process.env.ML_APP_ID ?? ""
  const mlClientSecret = stateMeta.ml_client_secret ?? process.env.ML_CLIENT_SECRET ?? ""

  if (!mlAppId || !mlClientSecret) {
    return NextResponse.redirect(new URL("/?error=ml_credentials_missing", url.origin))
  }

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
    const tokens = await exchangeMLCode(code, { appId: mlAppId, clientSecret: mlClientSecret })
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    const mlUserId = tokens.user_id

    const { data: upserted, error: upsertErr } = await service
      .from("sales_channels")
      .upsert(
        {
          tenant_id: stateRow.tenant_id,
          provider: "mercadolibre",
          external_id: String(mlUserId),
          display_name: `ML #${mlUserId}`,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expires_at: expiresAt,
          scopes: tokens.scope ? tokens.scope.split(" ") : null,
          status: "connected",
          last_error: null,
          connected_at: new Date().toISOString(),
          last_synced_at: new Date().toISOString(),
          created_by: stateRow.user_id,
          // Store tenant credentials so auto-refresh works without env vars
          metadata: {
            ml_user_id: mlUserId,
            ml_app_id: mlAppId,
            ml_client_secret: mlClientSecret,
          },
        },
        { onConflict: "tenant_id,provider,external_id" },
      )
      .select("id")
      .single()

    if (upsertErr) return fail(`db_${upsertErr.code ?? "error"}`)

    try {
      const userInfo = await fetchMLUserInfo(upserted.id)
      await service
        .from("sales_channels")
        .update({
          display_name: userInfo.nickname ?? `ML #${mlUserId}`,
          country: userInfo.country_id ?? null,
          metadata: {
            ml_user_id: mlUserId,
            ml_app_id: mlAppId,
            ml_client_secret: mlClientSecret,
            nickname: userInfo.nickname,
            email: userInfo.email,
            site_id: userInfo.site_id ?? "MLA",
            permalink: userInfo.permalink,
          },
        })
        .eq("id", upserted.id)
    } catch {
      // Non-fatal — channel is connected, enrichment can be retried later.
    }

    await service.from("channel_oauth_states").delete().eq("state", state)

    return NextResponse.redirect(
      new URL(`/app/${tenantSlug}/channels/${upserted.id}?connected=1`, url.origin),
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return fail(message)
  }
}

