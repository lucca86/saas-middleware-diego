"use server"

import { randomBytes } from "node:crypto"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { requireTenant } from "@/lib/tenant/context"
import { buildAuthorizeUrl, fetchStore, tiendaNubeIsConfigured } from "@/lib/channels/tiendanube"

/**
 * Kick off the Tienda Nube OAuth install flow. Stores a CSRF state row keyed
 * to (tenant, user) and 302-redirects the browser to TN's authorize URL.
 *
 * Permission: must be a tenant owner/admin/operator (validated by RLS on
 * channel_oauth_states via the service client + manual role check below).
 */
export async function startTiendaNubeConnect(tenantSlug: string) {
  if (!tiendaNubeIsConfigured()) {
    throw new Error("Tienda Nube no está configurado: faltan TIENDANUBE_APP_ID o TIENDANUBE_CLIENT_SECRET.")
  }
  const { tenant, role } = await requireTenant(tenantSlug)
  if (!["owner", "admin", "operator"].includes(role)) {
    throw new Error("No tenés permisos para conectar canales en este tenant.")
  }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado.")

  // Opaque, URL-safe random state token. 32 bytes = 256 bits of entropy.
  const state = randomBytes(32).toString("base64url")

  const service = createServiceClient()
  const { error } = await service.from("channel_oauth_states").insert({
    state,
    tenant_id: tenant.id,
    provider: "tiendanube",
    user_id: user.id,
  })
  if (error) throw new Error(`No se pudo iniciar el flujo OAuth: ${error.message}`)

  redirect(buildAuthorizeUrl(state))
}

/**
 * Disconnect a channel. We don't revoke the token on TN's side (their API
 * doesn't expose that endpoint to apps); we simply flip the status and
 * clear the credentials so the channel can't be used until reconnected.
 */
export async function disconnectChannel(tenantSlug: string, channelId: string) {
  const { tenant, role } = await requireTenant(tenantSlug)
  if (!["owner", "admin"].includes(role)) {
    return { ok: false as const, error: "Solo owner/admin pueden desconectar canales." }
  }
  const supabase = await createClient()
  const { error } = await supabase
    .from("sales_channels")
    .update({
      status: "disconnected",
      access_token: null,
      refresh_token: null,
      token_expires_at: null,
    })
    .eq("id", channelId)
    .eq("tenant_id", tenant.id)
  if (error) return { ok: false as const, error: error.message }

  revalidatePath(`/app/${tenantSlug}/channels`)
  revalidatePath(`/app/${tenantSlug}/channels/${channelId}`)
  return { ok: true as const }
}

export async function deleteChannel(tenantSlug: string, channelId: string) {
  const { tenant, role } = await requireTenant(tenantSlug)
  if (!["owner", "admin"].includes(role)) {
    return { ok: false as const, error: "Solo owner/admin pueden eliminar canales." }
  }
  const supabase = await createClient()
  const { error } = await supabase
    .from("sales_channels")
    .delete()
    .eq("id", channelId)
    .eq("tenant_id", tenant.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${tenantSlug}/channels`)
  return { ok: true as const }
}

/**
 * Smoke test against the live TN API: re-fetches /store and refreshes the
 * cached display fields. Returns a friendly error if the token has been
 * revoked from TN's side.
 */
export async function testChannelConnection(tenantSlug: string, channelId: string) {
  const { tenant } = await requireTenant(tenantSlug)
  const service = createServiceClient()
  const { data, error } = await service
    .from("sales_channels")
    .select("id, provider, external_id, access_token")
    .eq("id", channelId)
    .eq("tenant_id", tenant.id)
    .maybeSingle()
  if (error || !data) return { ok: false as const, error: "Canal no encontrado." }
  if (data.provider !== "tiendanube") {
    return { ok: false as const, error: "Provider no soportado todavía." }
  }
  if (!data.access_token) return { ok: false as const, error: "Canal desconectado." }

  try {
    const store = await fetchStore(data.external_id, data.access_token)
    await service
      .from("sales_channels")
      .update({
        status: "connected",
        last_error: null,
        last_synced_at: new Date().toISOString(),
        country: store.country ?? null,
        currency: store.main_currency ?? null,
        store_url: store.url ?? store.original_domain ?? null,
        metadata: { ...(store as unknown as Record<string, unknown>) },
      })
      .eq("id", channelId)
    revalidatePath(`/app/${tenantSlug}/channels/${channelId}`)
    return { ok: true as const }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await service
      .from("sales_channels")
      .update({ status: "error", last_error: message })
      .eq("id", channelId)
    return { ok: false as const, error: message }
  }
}
