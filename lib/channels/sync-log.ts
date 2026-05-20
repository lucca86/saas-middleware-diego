/**
 * Sync log writer — fire-and-forget helpers that record every channel event
 * into channel_sync_logs. All functions swallow errors so they never block
 * the primary operation.
 */
import { createServiceClient } from "@/lib/supabase/service"

export type SyncLogDirection = "sc_to_channel" | "channel_to_sc"
export type SyncLogEventType =
  | "import"
  | "push_product"
  | "push_stock"
  | "webhook_order"
  | "webhook_product"
  | "connect"
  | "error"
export type SyncLogStatus = "ok" | "partial" | "error" | "skipped"

export interface WriteSyncLogInput {
  tenantId: string
  channelId: string
  direction: SyncLogDirection
  eventType: SyncLogEventType
  status: SyncLogStatus
  summary?: string
  payload?: Record<string, unknown>
  productId?: string | null
  variantId?: string | null
  initiatedBy?: string | null
}

/**
 * Insert one sync log row. Never throws — errors are logged to stderr only.
 */
export async function writeSyncLog(input: WriteSyncLogInput): Promise<void> {
  try {
    const service = createServiceClient()
    await service.from("channel_sync_logs").insert({
      tenant_id: input.tenantId,
      channel_id: input.channelId,
      direction: input.direction,
      event_type: input.eventType,
      status: input.status,
      summary: input.summary ?? null,
      payload: input.payload ?? {},
      product_id: input.productId ?? null,
      variant_id: input.variantId ?? null,
      initiated_by: input.initiatedBy ?? null,
    })
  } catch (err) {
    console.error("[sync-log] write failed:", err)
  }
}

/** Convenience wrapper for import runs (one entry per run, not per product). */
export async function writeSyncLogImport(opts: {
  tenantId: string
  channelId: string
  status: SyncLogStatus
  summary: string
  payload: Record<string, unknown>
  initiatedBy?: string | null
}): Promise<void> {
  return writeSyncLog({
    ...opts,
    direction: "channel_to_sc",
    eventType: "import",
  })
}

/** Convenience wrapper for SC → WC product pushes. */
export async function writeSyncLogPush(opts: {
  tenantId: string
  channelId: string
  eventType: "push_product" | "push_stock"
  status: SyncLogStatus
  summary: string
  productId?: string | null
  variantId?: string | null
  payload?: Record<string, unknown>
}): Promise<void> {
  return writeSyncLog({
    ...opts,
    direction: "sc_to_channel",
    payload: opts.payload ?? {},
  })
}

/** Convenience wrapper for inbound WC webhooks. */
export async function writeSyncLogWebhook(opts: {
  tenantId: string
  channelId: string
  eventType: "webhook_order" | "webhook_product"
  status: SyncLogStatus
  summary: string
  payload?: Record<string, unknown>
}): Promise<void> {
  return writeSyncLog({
    ...opts,
    direction: "channel_to_sc",
    payload: opts.payload ?? {},
  })
}
