"use server"

import { randomBytes } from "node:crypto"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { requireTenant } from "@/lib/tenant/context"
import { buildAuthorizeUrl, fetchStore, tiendaNubeIsConfigured } from "@/lib/channels/tiendanube"
import { fetchStoreInfo, wooIsValidStoreUrl, type WooCredentials } from "@/lib/channels/woocommerce"
import { runWooImport } from "@/lib/channels/woocommerce-import"

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

/**
 * Connect a WooCommerce store using a Consumer Key + Secret pair. We probe
 * the store with `system_status` to validate the credentials before saving.
 *
 * If a channel already exists for the same (tenant, provider=woocommerce,
 * external_id=normalized_url) we update its credentials in place; otherwise
 * we create a new row. We DO NOT auto-import on connect — the user has to
 * confirm that step from the channel detail page because import is a
 * one-shot operation that can take minutes.
 */
export async function connectWooCommerce(
  tenantSlug: string,
  raw: { storeUrl: string; consumerKey: string; consumerSecret: string },
) {
  const { tenant, role } = await requireTenant(tenantSlug)
  if (!["owner", "admin", "operator"].includes(role)) {
    return { ok: false as const, error: "No tenés permisos para conectar canales." }
  }

  const storeUrl = raw.storeUrl.trim().replace(/\/+$/, "")
  if (!wooIsValidStoreUrl(storeUrl)) {
    return { ok: false as const, error: "URL de la tienda inválida. Incluí https://" }
  }
  const consumerKey = raw.consumerKey.trim()
  const consumerSecret = raw.consumerSecret.trim()
  if (!consumerKey.startsWith("ck_") || !consumerSecret.startsWith("cs_")) {
    return {
      ok: false as const,
      error: "Las claves deben empezar con ck_ y cs_. Generálas en WC → Ajustes → Avanzado → API REST.",
    }
  }

  const creds: WooCredentials = { storeUrl, consumerKey, consumerSecret }
  let info
  try {
    info = await fetchStoreInfo(creds)
  } catch (err) {
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : "No se pudo conectar con WooCommerce.",
    }
  }

  // Use the normalized URL as external_id so re-connecting the same store
  // updates the existing row instead of creating duplicates.
  const externalId = storeUrl

  const service = createServiceClient()
  const existing = await service
    .from("sales_channels")
    .select("id")
    .eq("tenant_id", tenant.id)
    .eq("provider", "woocommerce")
    .eq("external_id", externalId)
    .maybeSingle()

  const payload = {
    tenant_id: tenant.id,
    provider: "woocommerce" as const,
    external_id: externalId,
    display_name: info.name,
    store_url: info.url,
    country: info.country,
    currency: info.currency,
    access_token: consumerKey,
    refresh_token: consumerSecret,
    token_expires_at: null,
    scopes: ["read_write"],
    status: "connected" as const,
    last_error: null,
    metadata: { store_name: info.name } as Record<string, unknown>,
    connected_at: new Date().toISOString(),
  }

  let channelId: string
  if (existing.data?.id) {
    const upd = await service
      .from("sales_channels")
      .update(payload)
      .eq("id", existing.data.id)
      .select("id")
      .single()
    if (upd.error) return { ok: false as const, error: upd.error.message }
    channelId = upd.data.id as string
  } else {
    const ins = await service.from("sales_channels").insert(payload).select("id").single()
    if (ins.error) return { ok: false as const, error: ins.error.message }
    channelId = ins.data.id as string
  }

  revalidatePath(`/app/${tenantSlug}/channels`)
  return { ok: true as const, channelId }
}

/**
 * Trigger the one-shot WooCommerce → Stockcurve import for a connected
 * channel. Guarded by the existence of `metadata.last_import`: once any
 * import has run, subsequent calls require an explicit re-import flag so
 * the user can't accidentally pull twice and create duplicate type
 * attribute entries.
 */
export async function importWooCommerce(
  tenantSlug: string,
  channelId: string,
  opts: { force?: boolean } = {},
) {
  const { tenant, role } = await requireTenant(tenantSlug)
  if (!["owner", "admin"].includes(role)) {
    return { ok: false as const, error: "Solo owner/admin pueden importar." }
  }

  const service = createServiceClient()
  const { data, error } = await service
    .from("sales_channels")
    .select("id, provider, access_token, refresh_token, store_url, currency, metadata, status")
    .eq("id", channelId)
    .eq("tenant_id", tenant.id)
    .maybeSingle()
  if (error || !data) return { ok: false as const, error: "Canal no encontrado." }
  if (data.provider !== "woocommerce") {
    return { ok: false as const, error: "Este canal no es WooCommerce." }
  }
  if (!data.access_token || !data.refresh_token || !data.store_url) {
    return { ok: false as const, error: "Faltan credenciales. Reconectá el canal." }
  }
  const meta = (data.metadata ?? {}) as Record<string, unknown>
  if (meta.last_import && !opts.force) {
    return {
      ok: false as const,
      error: "Ya importaste antes. Pasá force=true para ejecutar de nuevo.",
    }
  }

  try {
    const summary = await runWooImport({
      tenantId: tenant.id,
      channelId,
      creds: {
        storeUrl: data.store_url,
        consumerKey: data.access_token,
        consumerSecret: data.refresh_token,
      },
      currency: data.currency ?? "ARS",
    })
    revalidatePath(`/app/${tenantSlug}/channels`)
    revalidatePath(`/app/${tenantSlug}/channels/${channelId}`)
    revalidatePath(`/app/${tenantSlug}/products`)
    return { ok: true as const, summary }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await service
      .from("sales_channels")
      .update({ status: "error", last_error: message })
      .eq("id", channelId)
    return { ok: false as const, error: message }
  }
}
