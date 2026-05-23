/**
 * GET /api/channels/tiendanube/import?channelId=xxx&tenantSlug=yyy
 *
 * Server-Sent Events endpoint that streams TiendaNube import progress.
 * Mirrors the WooCommerce import SSE route exactly.
 */
import { NextRequest } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"
import { requireTenant } from "@/lib/tenant/context"
import {
  runTiendaNubeImport,
  type TiendaNubeImportProgressEvent,
} from "@/lib/channels/tiendanube-import"

export const dynamic = "force-dynamic"
export const maxDuration = 300

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
    .select("id, provider, external_id, access_token, currency, metadata")
    .eq("id", channelId)
    .eq("tenant_id", tenantId)
    .maybeSingle()

  if (!channel) return new Response("Canal no encontrado", { status: 404 })
  if (channel.provider !== "tiendanube") return new Response("No es Tienda Nube", { status: 400 })
  if (!channel.access_token || !channel.external_id) {
    return new Response("Faltan credenciales", { status: 400 })
  }

  const meta = (channel.metadata ?? {}) as Record<string, unknown>
  if (meta.last_import && !force) {
    return new Response(
      sseEvent({ type: "error", message: "Ya se realizó un import. Usá force=true para reimportar." }),
      { status: 400, headers: { "Content-Type": "text/event-stream" } },
    )
  }

  const encoder = new TextEncoder()
  const stream = new TransformStream<string, Uint8Array>({
    transform(chunk, controller) {
      controller.enqueue(encoder.encode(chunk))
    },
  })
  const writer = stream.writable.getWriter()

  ;(async () => {
    try {
      await runTiendaNubeImport({
        tenantId,
        channelId,
        storeId: channel.external_id as string,
        accessToken: channel.access_token as string,
        currency: channel.currency ?? "ARS",
        onProgress: (event: TiendaNubeImportProgressEvent) => {
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
