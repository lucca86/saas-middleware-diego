import "server-only"
import { createClient } from "@/lib/supabase/server"

export interface SalesChannelRow {
  id: string
  tenant_id: string
  provider: "tiendanube" | "woocommerce" | "mercadolibre" | "shopify" | "custom"
  external_id: string
  display_name: string | null
  store_url: string | null
  country: string | null
  currency: string | null
  scopes: string[] | null
  metadata: Record<string, unknown>
  status: "connected" | "disconnected" | "error" | "revoked"
  last_error: string | null
  connected_at: string
  last_synced_at: string | null
  created_at: string
  updated_at: string
}

/**
 * List all sales channels for a tenant. Sensitive fields (access_token,
 * refresh_token) are intentionally excluded.
 */
export async function listChannels(tenantId: string): Promise<SalesChannelRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("sales_channels")
    .select(
      "id, tenant_id, provider, external_id, display_name, store_url, country, currency, scopes, metadata, status, last_error, connected_at, last_synced_at, created_at, updated_at",
    )
    .eq("tenant_id", tenantId)
    .order("connected_at", { ascending: false })
  if (error) throw error
  return (data ?? []) as SalesChannelRow[]
}

export async function getChannel(tenantId: string, id: string): Promise<SalesChannelRow | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("sales_channels")
    .select(
      "id, tenant_id, provider, external_id, display_name, store_url, country, currency, scopes, metadata, status, last_error, connected_at, last_synced_at, created_at, updated_at",
    )
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .maybeSingle()
  if (error) throw error
  return (data ?? null) as SalesChannelRow | null
}
