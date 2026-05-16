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
import { registerWooWebhooks } from "@/app/app/[tenant]/channels/actions"
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
  lastImportAt: string | null
  lastImportSummary: ImportSummary | null
}

export function WooCommerceImportCard({
  tenantSlug,
  channelId,
  canManage,
  lastImportAt,
  lastImportSummary,
}: Props) {
  const router = useRouter()
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<ProgressState | null>(null)
  const [webhookPending, startWebhook] = useTransition()
  const [webhookUrl, setWebhookUrl] = useState<string | null>(null)
  const esRef = useRef<EventSource | null>(null)

  const alreadyImported = Boolean(lastImportAt)

  const startImport = useCallback(
    (force: boolean) => {
      if (running) return
      setRunning(true)
      setProgress({
        phase: "fetching",
        current: 0,
        total: 0,
        productName: "Conectando con WooCommerce…",
        status: "ok",
        pct: 0,
        log: [],
      })

      const params = new URLSearchParams({ channelId, tenantSlug })
      if (force) params.set("force", "true")
      const es = new EventSource(`/api/channels/woocommerce/import?${params}`)
      esRef.current = es

      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data) as {
            type: string
            phase?: "fetching" | "importing" | "done"
            current?: number
            total?: number
            productName?: string
            status?: "ok" | "skip" | "error"
            error?: string
            message?: string
          }

          if (data.type === "progress") {
            const phase = data.phase ?? "importing"
            const current = data.current ?? 0
            const total = data.total ?? 0
            const productName = data.productName ?? ""
            const status = data.status ?? "ok"
            const pct = total > 0 ? Math.round((current / total) * 100) : 0

            setProgress((prev) => {
              const log = prev?.log ? [...prev.log] : []
              if (phase === "importing" && productName && productName !== prev?.productName) {
                log.unshift({ name: productName, status, error: data.error })
                if (log.length > 8) log.pop()
              }
              return { phase, current, total, productName, status, pct, log }
            })
          } else if (data.type === "error") {
            toast.error(data.message ?? "Error en el import")
            setRunning(false)
            es.close()
          } else if (data.type === "done") {
            setProgress((prev) => (prev ? { ...prev, phase: "done", pct: 100 } : prev))
            setRunning(false)
            es.close()
            router.refresh()
          }
        } catch {
          // ignore malformed events
        }
      }

      es.onerror = () => {
        es.close()
        setRunning(false)
        toast.error("Se perdió la conexión durante el import.")
      }
    },
    [channelId, tenantSlug, running, router],
  )

  function handleWebhooks() {
    startWebhook(async () => {
      const res = await registerWooWebhooks(tenantSlug, channelId)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      setWebhookUrl(res.deliveryUrl)
      toast.success("Webhooks registrados en WooCommerce.")
      router.refresh()
    })
  }

  const pct = progress?.pct ?? 0
  const isDone = !running && progress?.phase === "done"

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.16em] text-muted-foreground">
          <Download className="h-4 w-4" />
          Importacion WooCommerce
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">

        {/* ── Progress section (visible while running or just finished) ── */}
        {(running || isDone) && (
          <div className="space-y-2.5 rounded-md border border-border bg-background/40 p-3">
            {/* Header row */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {progress?.phase === "fetching"
                  ? "Descargando catalogo de WooCommerce…"
                  : progress?.phase === "done"
                    ? "Import finalizado"
                    : `Importando ${progress?.current ?? 0} / ${progress?.total ?? 0} productos`}
              </span>
              <span className="font-mono font-bold tabular-nums text-foreground">{pct}%</span>
            </div>

            {/* Bar */}
            <Progress value={pct} className="h-1.5" />

            {/* Current product name */}
            {progress?.phase === "importing" && progress.productName && (
              <p className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                {progress.status === "error" && (
                  <AlertTriangle className="h-3 w-3 shrink-0 text-destructive" />
                )}
                {progress.productName}
              </p>
            )}

            {/* Live log (last 8) */}
            {(progress?.log ?? []).length > 0 && (
              <ul className="max-h-36 space-y-0.5 overflow-y-auto">
                {(progress?.log ?? []).map((entry, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-[11px] leading-snug">
                    {entry.status === "ok" ? (
                      <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-green-500" />
                    ) : entry.status === "skip" ? (
                      <SkipForward className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                    ) : (
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-destructive" />
                    )}
                    <span
                      className={
                        entry.status === "error" ? "text-destructive" : "text-muted-foreground"
                      }
                    >
                      {entry.name}
                      {entry.error && (
                        <span className="ml-1 opacity-60">
                          — {entry.error.split(":").pop()?.trim()}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {/* Done badge */}
            {isDone && (
              <div className="flex items-center gap-1.5 rounded-md bg-green-500/10 px-2 py-1.5 text-xs font-medium text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Import completado
              </div>
            )}
          </div>
        )}

        {/* ── Last import summary (static, when not running) ── */}
        {!running && !isDone && lastImportSummary && (
          <div className="rounded-md border border-border bg-background/40 p-3 text-xs">
            <p className="mb-2 font-medium text-foreground">Ultimo import</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 font-mono">
              <span className="text-muted-foreground">Total en WooCommerce</span>
              <span className="text-foreground">{lastImportSummary.total}</span>
              <span className="text-muted-foreground">Importados</span>
              <span className="text-green-500">{lastImportSummary.imported}</span>
              <span className="text-muted-foreground">Omitidos</span>
              <span className="text-muted-foreground">{lastImportSummary.skipped}</span>
              {lastImportSummary.failed > 0 && (
                <>
                  <span className="text-muted-foreground">Fallaron</span>
                  <span className="text-destructive">{lastImportSummary.failed}</span>
                </>
              )}
            </div>
            {lastImportSummary.errors.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer select-none text-destructive/80 hover:text-destructive">
                  Ver errores ({lastImportSummary.errors.length})
                </summary>
                <ul className="mt-1.5 max-h-32 space-y-0.5 overflow-y-auto pl-2 text-[11px] text-destructive/80">
                  {lastImportSummary.errors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}

        {/* ── Intro text (first-time) ── */}
        {!running && !alreadyImported && !isDone && (
          <p className="text-sm text-muted-foreground">
            Traje todo el catalogo de WooCommerce a este tenant: productos, variantes, precios, stock e
            imagenes.{" "}
            <strong className="text-foreground">
              La importacion es una sola vez
            </strong>
            ; despues Stockcurve es la fuente de verdad.
          </p>
        )}

        {/* ── Action buttons ── */}
        {canManage && (
          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
            {!alreadyImported ? (
              <Button
                type="button"
                size="sm"
                disabled={running}
                onClick={() => startImport(false)}
              >
                <Download className="mr-1.5 h-4 w-4" />
                {running ? "Importando…" : "Importar desde WooCommerce"}
              </Button>
            ) : (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={running}
                    className="bg-transparent"
                  >
                    <RefreshCw className="mr-1.5 h-4 w-4" />
                    {running ? "Importando…" : "Re-importar"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Re-importar desde WooCommerce</AlertDialogTitle>
                    <AlertDialogDescription>
                      Los productos que ya existen en Stockcurve seran omitidos — no se
                      sobreescriben. Solo se crearan los que aun no fueron importados.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => startImport(true)}>
                      Confirmar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            {alreadyImported && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={webhookPending}
                onClick={handleWebhooks}
              >
                <Webhook className="mr-1.5 h-4 w-4" />
                {webhookPending ? "Registrando…" : "Registrar webhooks"}
              </Button>
            )}
          </div>
        )}

        {/* Webhook URL confirmation */}
        {webhookUrl && (
          <p className="break-all rounded-md bg-muted px-2 py-1.5 font-mono text-[11px] text-muted-foreground">
            {webhookUrl}
          </p>
        )}

        {/* Last import timestamp */}
        {lastImportAt && !running && (
          <p className="text-[11px] text-muted-foreground">
            Ultimo import:{" "}
            {new Intl.DateTimeFormat("es-AR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            }).format(new Date(lastImportAt))}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
