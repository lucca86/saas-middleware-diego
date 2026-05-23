"use client"

import { useState, useTransition, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { registerTiendaNubeWebhooks } from "@/app/app/[tenant]/channels/actions"
import { Download, CheckCircle2, AlertTriangle, Webhook, RefreshCw, SkipForward } from "lucide-react"

interface ImportSummary {
  total: number
  imported: number
  skipped: number
  failed: number
  errors: string[]
}

interface ProgressState {
  phase: "fetching" | "importing" | "done"
  current: number
  total: number
  productName: string
  status: "ok" | "skip" | "error"
  pct: number
  log: Array<{ name: string; status: "ok" | "skip" | "error"; error?: string }>
}

interface Props {
  tenantSlug: string
  channelId: string
  canManage: boolean
  lastImportAt?: string | null
  lastImportSummary?: ImportSummary | null
}

export function TiendaNubeImportCard({
  tenantSlug,
  channelId,
  canManage,
  lastImportAt,
  lastImportSummary,
}: Props) {
  const router = useRouter()
  const [progress, setProgress] = useState<ProgressState | null>(null)
  const [summary, setSummary] = useState<ImportSummary | null>(lastImportSummary ?? null)
  const [webhookPending, startWebhook] = useTransition()
  const [webhookUrl, setWebhookUrl] = useState<string | null>(null)
  const esRef = useRef<EventSource | null>(null)

  const alreadyImported = Boolean(lastImportAt)

  const startImport = useCallback(
    (force: boolean) => {
      if (esRef.current) {
        esRef.current.close()
      }

      setProgress({
        phase: "fetching",
        current: 0,
        total: 0,
        productName: "Iniciando…",
        status: "ok",
        pct: 0,
        log: [],
      })
      setSummary(null)

      const url = `/api/channels/tiendanube/import?channelId=${channelId}&tenantSlug=${tenantSlug}${force ? "&force=true" : ""}`
      const es = new EventSource(url)
      esRef.current = es

      es.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data) as Record<string, unknown>

          if (event.type === "progress") {
            const ev = event as {
              type: string
              phase: ProgressState["phase"]
              current: number
              total: number
              productName: string
              status: "ok" | "skip" | "error"
              error?: string
              summary?: ImportSummary
            }

            setProgress((prev) => {
              const newLog =
                ev.phase === "importing" && ev.productName
                  ? [
                      ...(prev?.log ?? []).slice(-49),
                      { name: ev.productName, status: ev.status, error: ev.error },
                    ]
                  : (prev?.log ?? [])

              const pct =
                ev.total > 0
                  ? Math.round((ev.current / ev.total) * 100)
                  : ev.phase === "fetching"
                    ? 5
                    : 0

              return {
                phase: ev.phase,
                current: ev.current,
                total: ev.total,
                productName: ev.productName,
                status: ev.status,
                pct,
                log: newLog,
              }
            })

            if (ev.phase === "done" && ev.summary) {
              setSummary(ev.summary)
              es.close()
              router.refresh()
            }
          } else if (event.type === "done") {
            es.close()
            router.refresh()
          } else if (event.type === "error") {
            toast.error(String(event.message ?? "Error desconocido"))
            es.close()
            setProgress(null)
          }
        } catch {
          // ignore parse errors
        }
      }

      es.onerror = () => {
        toast.error("Se perdió la conexión con el servidor.")
        es.close()
        setProgress(null)
      }
    },
    [channelId, tenantSlug, router],
  )

  function triggerWebhooks() {
    startWebhook(async () => {
      const res = await registerTiendaNubeWebhooks(tenantSlug, channelId)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      setWebhookUrl(res.deliveryUrl)
      toast.success("Webhooks registrados correctamente en Tienda Nube.")
      router.refresh()
    })
  }

  const isRunning = progress !== null && progress.phase !== "done"
  const isDone = progress?.phase === "done"

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Importar catálogo</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {/* Initial state: no import yet */}
        {!alreadyImported && !progress && (
          <div className="space-y-3">
            <p className="text-muted-foreground">
              Importá todos los productos y variantes de tu Tienda Nube a Stockcurve. Esta operación es
              segura y no modifica tu tienda.
            </p>
            {canManage && (
              <Button
                type="button"
                size="sm"
                onClick={() => startImport(false)}
                disabled={isRunning}
              >
                <Download className="mr-1.5 h-4 w-4" />
                Importar ahora
              </Button>
            )}
          </div>
        )}

        {/* Already imported but not running */}
        {alreadyImported && !progress && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5 text-tertiary" />
              <span>
                Último import:{" "}
                <span suppressHydrationWarning>
                  {new Date(lastImportAt!).toLocaleString("es-AR")}
                </span>
              </span>
            </div>
            {summary && (
              <SummaryBadges summary={summary} />
            )}
            {canManage && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="outline" size="sm" className="bg-transparent">
                    <RefreshCw className="mr-1.5 h-4 w-4" />
                    Re-importar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Re-importar catálogo?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Los productos que ya existen en Stockcurve se omitirán (no se duplican). Solo se
                      importarán los nuevos. Esta acción puede tardar varios minutos.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => startImport(true)}>
                      Reimportar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        )}

        {/* Progress state */}
        {progress && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {progress.phase === "fetching" ? "Descargando catálogo…" : progress.productName}
                </span>
                <span className="font-mono text-foreground">
                  {progress.phase === "importing"
                    ? `${progress.current}/${progress.total}`
                    : `${progress.pct}%`}
                </span>
              </div>
              <Progress value={progress.pct} className="h-1.5" />
            </div>

            {/* Rolling log of last ~10 products */}
            {progress.log.length > 0 && (
              <div className="max-h-36 overflow-y-auto rounded-md border border-border bg-muted/30 p-2">
                {progress.log
                  .slice(-10)
                  .reverse()
                  .map((entry, i) => (
                    <div key={i} className="flex items-start gap-1.5 py-0.5">
                      {entry.status === "ok" ? (
                        <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-tertiary" />
                      ) : entry.status === "skip" ? (
                        <SkipForward className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                      ) : (
                        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-destructive" />
                      )}
                      <span
                        className={`font-mono text-[11px] leading-tight ${
                          entry.status === "error"
                            ? "text-destructive"
                            : entry.status === "skip"
                              ? "text-muted-foreground"
                              : "text-foreground"
                        }`}
                      >
                        {entry.name}
                        {entry.error ? `: ${entry.error}` : ""}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* Final summary after run */}
        {isDone && summary && (
          <div className="space-y-3 border-t border-border pt-3">
            <SummaryBadges summary={summary} />
            {summary.errors.length > 0 && (
              <details className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
                <summary className="cursor-pointer text-xs font-medium text-destructive">
                  {summary.errors.length} error{summary.errors.length !== 1 ? "es" : ""}
                </summary>
                <ul className="mt-2 space-y-1">
                  {summary.errors.map((err, i) => (
                    <li key={i} className="font-mono text-[11px] text-destructive break-all">
                      {err}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}

        {/* Webhook registration */}
        {canManage && alreadyImported && !isRunning && (
          <div className="border-t border-border pt-3 space-y-2">
            <p className="text-xs font-medium text-foreground">Pedidos en tiempo real</p>
            <p className="text-xs text-muted-foreground">
              Registrá webhooks en tu Tienda Nube para recibir pedidos automáticamente y descontar stock.
            </p>
            {webhookUrl && (
              <p className="rounded-md bg-muted px-2 py-1 font-mono text-[11px] text-muted-foreground break-all">
                {webhookUrl}
              </p>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="bg-transparent"
              disabled={webhookPending}
              onClick={triggerWebhooks}
            >
              <Webhook className="mr-1.5 h-4 w-4" />
              {webhookPending ? "Registrando…" : "Registrar webhooks"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function SummaryBadges({ summary }: { summary: ImportSummary }) {
  return (
    <div className="flex flex-wrap gap-2 text-xs">
      <span className="rounded-md bg-tertiary/10 px-2 py-1 text-tertiary">
        {summary.imported} importados
      </span>
      <span className="rounded-md bg-muted px-2 py-1 text-muted-foreground">
        {summary.skipped} omitidos
      </span>
      {summary.failed > 0 && (
        <span className="rounded-md bg-destructive/10 px-2 py-1 text-destructive">
          {summary.failed} fallaron
        </span>
      )}
      <span className="rounded-md bg-muted px-2 py-1 text-muted-foreground">
        {summary.total} total
      </span>
    </div>
  )
}
