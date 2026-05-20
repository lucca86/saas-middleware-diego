import "server-only"
import { createClient } from "@/lib/supabase/server"

export interface SyncLogEntry {
  id: string
  direction: "sc_to_channel" | "channel_to_sc"
  event_type: string
  status: "ok" | "partial" | "error" | "skipped"
  summary: string | null
  payload: Record<string, unknown>
  product_id: string | null
  variant_id: string | null
  created_at: string
  product?: { name: string } | null
}

export async function getSyncLogs(
  tenantId: string,
  channelId: string,
  opts: { limit?: number; offset?: number; status?: string } = {},
): Promise<{ rows: SyncLogEntry[]; total: number }> {
  const supabase = await createClient()
  const limit = opts.limit ?? 50
  const offset = opts.offset ?? 0

  let query = supabase
    .from("channel_sync_logs")
    .select(
      `id, direction, event_type, status, summary, payload, product_id, variant_id, created_at,
       product:products(name)`,
      { count: "exact" },
    )
    .eq("tenant_id", tenantId)
    .eq("channel_id", channelId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (opts.status) {
    query = query.eq("status", opts.status)
  }

  const { data, count, error } = await query
  if (error) throw error

  return {
    rows: (data ?? []).map((row) => ({
      ...row,
      // Supabase returns foreign-key joins as arrays even for single rows.
      product: Array.isArray(row.product)
        ? (row.product[0] ?? null)
        : (row.product ?? null),
    })) as SyncLogEntry[],
    total: count ?? 0,
  }
}
