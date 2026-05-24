import "server-only"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { runTiendaNubeExport } from "@/lib/channels/tiendanube-export"

export const runtime = "nodejs"
export const maxDuration = 300

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const channelId = searchParams.get("channelId")
  const tenantId = searchParams.get("tenantId")

  if (!channelId || !tenantId) {
    return new Response("channelId y tenantId requeridos", { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("No autorizado", { status: 401 })

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

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      try {
        const meta = (channel.metadata ?? {}) as Record<string, unknown>
        const lang = typeof meta.main_language === "string" ? meta.main_language : "es"

        const summary = await runTiendaNubeExport({
          tenantId,
          channelId,
          storeId: channel.external_id as string,
          accessToken: channel.access_token as string,
          lang,
          onProgress: (event) => send(event),
        })

        // Persist summary in channel metadata.
        await service
          .from("sales_channels")
          .update({
            metadata: {
              ...(channel.metadata as object),
              last_export: new Date().toISOString(),
              last_export_summary: summary,
            },
          })
          .eq("id", channelId)

        send({ phase: "done", summary })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        send({ phase: "error", error: message })
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
