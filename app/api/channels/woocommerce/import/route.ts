/**
 * GET /api/channels/woocommerce/import?channelId=xxx&tenantSlug=yyy
 *
 * Server-Sent Events endpoint that streams import progress.
 * Auth: validated via requireTenant (reads cookies from headers).
 */
import { NextRequest } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"
import { requireTenant } from "@/lib/tenant/context"
import { runWooImport, type ImportProgressEvent } from "@/lib/channels/woocommerce-import"
import type { WooCredentials } from "@/lib/channels/woocommerce"

export const dynamic = "force-dynamic"
export const maxDuration = 300 // 5 min Vercel function limit

function sseEvent(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`
}

export async function GET(req: NextRequest) {
  const channelId = req.nextUrl.searchParams.get("channelId")
  const tenantSlug = req.nextUrl.searchParams.get("tenantSlug")
  const force = req.nextUrl.searchParams.get("force") === "true"

  if (!channelId || !tenantSlug) {
    return new Response("channelId and tenantSlug are required", { status: 400 })
  }

  // Auth check
  let tenantId: string
  try {
    const { tenant, role } = await requireTenant(tenantSlug)
    if (!["owner", "admin"].includes(role)) {
      return new Response("Forbidden", { status: 403 })
    }
    tenantId = tenant.id
  } catch {
    return new Response("Unauthorized", { status: 401 })
  }

  const service = createServiceClient()
  const { data: channel } = await service
    .from("sales_channels")
    .select("id, provider, access_token, refresh_token, store_url, currency, metadata")
    .eq("id", channelId)
    .eq("tenant_id", tenantId)
    .maybeSingle()

  if (!channel) return new Response("Canal no encontrado", { status: 404 })
  if (channel.provider !== "woocommerce") return new Response("No es WooCommerce", { status: 400 })
  if (!channel.access_token || !channel.refresh_token || !channel.store_url) {
    return new Response("Faltan credenciales", { status: 400 })
  }

  const meta = (channel.metadata ?? {}) as Record<string, unknown>
  if (meta.last_import_at && !force) {
    return new Response(
      sseEvent({ type: "error", message: "Ya se realizó un import. Usá force=true para reimportar." }),
      { status: 400, headers: { "Content-Type": "text/event-stream" } },
    )
  }

  const creds: WooCredentials = {
    storeUrl: channel.store_url,
    consumerKey: channel.access_token,
    consumerSecret: channel.refresh_token,
  }

  const encoder = new TextEncoder()
  const stream = new TransformStream<string, Uint8Array>({
    transform(chunk, controller) {
      controller.enqueue(encoder.encode(chunk))
    },
  })
  const writer = stream.writable.getWriter()

  // Run import in background, streaming events to the client
  ;(async () => {
    try {
      await runWooImport({
        tenantId,
        channelId,
        creds,
        currency: channel.currency ?? "ARS",
        onProgress: (event: ImportProgressEvent) => {
          writer.write(sseEvent({ type: "progress", ...event })).catch(() => {})
        },
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      writer.write(sseEvent({ type: "error", message: msg })).catch(() => {})
    } finally {
      writer.write(sseEvent({ type: "done" })).catch(() => {})
      writer.close().catch(() => {})
    }
  })()

  return new Response(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
