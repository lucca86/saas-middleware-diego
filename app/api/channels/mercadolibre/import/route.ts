import { type NextRequest } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"
import { createClient } from "@/lib/supabase/server"
import { runMLImport } from "@/lib/channels/mercadolibre-import"

export const runtime = "nodejs"
export const maxDuration = 300

export async function GET(req: NextRequest) {
  const channelId = req.nextUrl.searchParams.get("channelId")
  const tenantId = req.nextUrl.searchParams.get("tenantId")

  if (!channelId || !tenantId) {
    return new Response("Missing channelId or tenantId", { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  const service = createServiceClient()
  const { data: channel } = await service
    .from("sales_channels")
    .select("id, provider, tenant_id, metadata")
    .eq("id", channelId)
    .eq("tenant_id", tenantId)
    .maybeSingle()

  if (!channel || channel.provider !== "mercadolibre") {
    return new Response("Canal no encontrado", { status: 404 })
  }

  const meta = (channel.metadata ?? {}) as Record<string, unknown>
  const mlUserId = Number(meta.ml_user_id)
  if (!mlUserId) return new Response("ml_user_id no encontrado en el canal", { status: 400 })

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }
      try {
        for await (const event of runMLImport({ tenantId, channelId, mlUserId })) {
          send(event)
          if (event.type === "done" || event.type === "error") break
        }
      } catch (err) {
        send({ type: "error", error: err instanceof Error ? err.message : String(err) })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
