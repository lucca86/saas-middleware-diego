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
import {
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Webhook,
  RefreshCw,
  SkipForward,
} from "lucide-react"

interface ImportSummary {
  total: number
  imported: number
  skipped: number
  failed: number
  errors: string[]
}

interface ExportSummary {
  total: number
  created: number
  updated: number
  skipped: number
  failed: number
  errors: string[]
}

interface ProgressState {
  phase: string
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
  tenantId: string
  canManage: boolean
  lastImportAt?: string | null
  lastImportSummary?: ImportSummary | null
  lastExportAt?: string | null
  lastExportSummary?: ExportSummary | null
}

export function TiendaNubeImportCard({
  tenantSlug,
  channelId,
  tenantId,
  canManage,
  lastImportAt,
  lastImportSummary,
  lastExportAt,
  lastExportSummary,
}: Props) {
  const router = useRouter()

  // Import state
  const [importProgress, setImportProgress] = useState<ProgressState | null>(null)
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(lastImportSummary ?? null)
  const importEsRef = useRef<EventSource | null>(null)

  // Export state
  const [exportProgress, setExportProgress] = useState<ProgressState | null>(null)
  const [exportSummary, setExportSummary] = useState<ExportSummary | null>(lastExportSummary ?? null)
  const exportEsRef = useRef<EventSource | null>(null)

  // Webhooks
  const [webhookPending, startWebhook] = useTransition()
  const [webhookUrl, setWebhookUrl] = useState<string | null>(null)

  // ── Import ────────────────────────────────────────────────────────────────
  const startImport = useCallback(
    (force: boolean) => {
      importEsRef.current?.close()
      setImportProgress({ phase: "fetching", current: 0, total: 0, productName: "Iniciando…", status: "ok", pct: 0, log: [] })
      setImportSummary(null)

      const url = `/api/channels/tiendanube/import?channelId=${channelId}&tenantSlug=${tenantSlug}${force ? "&force=true" : ""}`
      const es = new EventSource(url)
      importEsRef.current = es

      es.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data) as Record<string, unknown>
          if (event.type === "progress") {
            const ev = event as { type: string; phase: string; current: number; total: number; productName: string; status: "ok" | "skip" | "error"; error?: string; summary?: ImportSummary }
            setImportProgress((prev) => {
              const newLog = ev.phase === "importing" && ev.productName
                ? [...(prev?.log ?? []).slice(-49), { name: ev.productName, status: ev.status, error: ev.error }]
                : (prev?.log ?? [])
              const pct = ev.total > 0 ? Math.round((ev.current / ev.total) * 100) : ev.phase === "fetching" ? 5 : 0
              return { phase: ev.phase, current: ev.current, total: ev.total, productName: ev.productName, status: ev.status, pct, log: newLog }
            })
            if (ev.phase === "done" && ev.summary) {
              setImportSummary(ev.summary)
              es.close()
              router.refresh()
            }
          } else if (event.type === "error") {
            toast.error(String(event.message ?? "Error desconocido"))
            es.close()
            setImportProgress(null)
          }
        } catch { /* ignore */ }
      }
      es.onerror = () => { toast.error("Se perdió la conexión."); es.close(); setImportProgress(null) }
    },
    [channelId, tenantSlug, router],
  )

  // ── Export ────────────────────────────────────────────────────────────────
  const startExport = useCallback(
    (force: boolean) => {
      exportEsRef.current?.close()
      setExportProgress({ phase: "loading", current: 0, total: 0, productName: "Cargando catálogo…", status: "ok", pct: 0, log: [] })
      setExportSummary(null)

      const url = `/api/channels/tiendanube/export?channelId=${channelId}&tenantId=${tenantId}${force ? "&force=true" : ""}`
      const es = new EventSource(url)
      exportEsRef.current = es

      es.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data) as Record<string, unknown>
          if (event.phase && event.phase !== "done" && event.phase !== "error") {
            const ev = event as { phase: string; current: number; total: number; productName: string; status: "ok" | "skip" | "error"; error?: string }
            setExportProgress((prev) => {
              const newLog = ev.phase === "exporting" && ev.productName
                ? [...(prev?.log ?? []).slice(-49), { name: ev.productName, status: ev.status, error: ev.error }]
                : (prev?.log ?? [])
              const pct = ev.total > 0 ? Math.round((ev.current / ev.total) * 100) : ev.phase === "loading" ? 5 : 0
              return { phase: ev.phase, current: ev.current, total: ev.total, productName: ev.productName, status: ev.status, pct, log: newLog }
            })
          } else if (event.phase === "done") {
            setExportSummary(event.summary as ExportSummary)
            es.close()
            router.refresh()
          } else if (event.phase === "error") {
            toast.error(String(event.error ?? "Error desconocido"))
            es.close()
            setExportProgress(null)
          }
        } catch { /* ignore */ }
      }
      es.onerror = () => { toast.error("Se perdió la conexión."); es.close(); setExportProgress(null) }
    },
    [channelId, tenantId, router],
  )

  // ── Webhooks ──────────────────────────────────────────────────────────────
  function triggerWebhooks() {
    startWebhook(async () => {
      const res = await registerTiendaNubeWebhooks(tenantSlug, channelId)
      if (!res.ok) { toast.error(res.error); return }
      setWebhookUrl(res.deliveryUrl)
      toast.success("Webhooks registrados en Tienda Nube.")
      router.refresh()
    })
  }

  const importRunning = importProgress !== null && importProgress.phase !== "done"
  const exportRunning = exportProgress !== null && exportProgress.phase !== "done"

  return (
    <div className="space-y-4">
      {/* ── Export Card ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Upload className="h-4 w-4 text-primary" />
            Subir catálogo a Tienda Nube
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-muted-foreground text-xs">
            Publica los productos de Stockcurve en tu tienda. Los productos que ya existen en TN se actualizan; los nuevos se crean.
          </p>

          {/* No export yet */}
          {!exportProgress && !exportSummary && canManage && (
            <Button type="button" size="sm" onClick={() => startExport(false)} disabled={exportRunning}>
              <Upload className="mr-1.5 h-4 w-4" />
              Subir productos
            </Button>
          )}

          {/* Already exported */}
          {!exportProgress && exportSummary && (
            <div className="space-y-3">
              {lastExportAt && (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5 text-tertiary" />
                  <span suppressHydrationWarning>Último export: {new Date(lastExportAt).toLocaleString("es-AR")}</span>
                </p>
              )}
              <ExportSummaryBadges summary={exportSummary} />
              {exportSummary.errors.length > 0 && (
                <ErrorList errors={exportSummary.errors} />
              )}
              {canManage && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button type="button" variant="outline" size="sm" className="bg-transparent">
                      <RefreshCw className="mr-1.5 h-4 w-4" />
                      Re-exportar
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Re-exportar catálogo?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Los productos ya publicados en TN se actualizarán. Los nuevos se crearán. Esta acción puede tardar varios minutos.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => startExport(true)}>Re-exportar</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          )}

          {/* Export progress */}
          {exportProgress && (
            <ProgressBlock
              progress={exportProgress}
              runningLabel={exportProgress.phase === "loading" ? "Cargando catálogo…" : "Publicando en Tienda Nube…"}
            />
          )}
        </CardContent>
      </Card>

      {/* ── Import Card ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Download className="h-4 w-4 text-primary" />
            Importar catálogo desde Tienda Nube
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-muted-foreground text-xs">
            Trae los productos y variantes de tu Tienda Nube a Stockcurve. No modifica tu tienda.
          </p>

          {!importProgress && !lastImportAt && canManage && (
            <Button type="button" size="sm" onClick={() => startImport(false)} disabled={importRunning}>
              <Download className="mr-1.5 h-4 w-4" />
              Importar ahora
            </Button>
          )}

          {!importProgress && lastImportAt && (
            <div className="space-y-3">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-tertiary" />
                <span suppressHydrationWarning>Último import: {new Date(lastImportAt).toLocaleString("es-AR")}</span>
              </p>
              {importSummary && <ImportSummaryBadges summary={importSummary} />}
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
                        Los productos ya importados se omitirán. Solo entran los nuevos.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => startImport(true)}>Reimportar</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          )}

          {importProgress && (
            <ProgressBlock
              progress={importProgress}
              runningLabel={importProgress.phase === "fetching" ? "Descargando catálogo…" : "Importando productos…"}
            />
          )}

          {importProgress?.phase === "done" && importSummary && (
            <div className="border-t border-border pt-3 space-y-2">
              <ImportSummaryBadges summary={importSummary} />
              {importSummary.errors.length > 0 && <ErrorList errors={importSummary.errors} />}
            </div>
          )}

          {/* Webhooks */}
          {canManage && !importRunning && (
            <div className="border-t border-border pt-3 space-y-2">
              <p className="text-xs font-medium">Pedidos en tiempo real</p>
              <p className="text-xs text-muted-foreground">
                Registrá webhooks para recibir pedidos automáticamente y descontar stock.
              </p>
              {webhookUrl && (
                <p className="rounded-md bg-muted px-2 py-1 font-mono text-[11px] text-muted-foreground break-all">
                  {webhookUrl}
                </p>
              )}
              <Button type="button" variant="outline" size="sm" className="bg-transparent" disabled={webhookPending} onClick={triggerWebhooks}>
                <Webhook className="mr-1.5 h-4 w-4" />
                {webhookPending ? "Registrando…" : "Registrar webhooks"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ── Shared sub-components ──────────────────────────────────────────────────────

function ProgressBlock({ progress, runningLabel }: { progress: ProgressState; runningLabel: string }) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground truncate max-w-[65%]">
            {progress.phase === "loading" || progress.phase === "fetching" ? runningLabel : progress.productName}
          </span>
          <span className="font-mono text-foreground">
            {progress.total > 0 ? `${progress.current}/${progress.total}` : `${progress.pct}%`}
          </span>
        </div>
        <Progress value={progress.pct} className="h-1.5" />
      </div>
      {progress.log.length > 0 && (
        <div className="max-h-36 overflow-y-auto rounded-md border border-border bg-muted/30 p-2">
          {progress.log.slice(-10).reverse().map((entry, i) => (
            <div key={i} className="flex items-start gap-1.5 py-0.5">
              {entry.status === "ok"
                ? <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-tertiary" />
                : entry.status === "skip"
                ? <SkipForward className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                : <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-destructive" />}
              <span className={`font-mono text-[11px] leading-tight break-all ${entry.status === "error" ? "text-destructive" : entry.status === "skip" ? "text-muted-foreground" : "text-foreground"}`}>
                {entry.name}{entry.error ? `: ${entry.error}` : ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ImportSummaryBadges({ summary }: { summary: ImportSummary }) {
  return (
    <div className="flex flex-wrap gap-2 text-xs">
      <span className="rounded-md bg-tertiary/10 px-2 py-1 text-tertiary">{summary.imported} importados</span>
      <span className="rounded-md bg-muted px-2 py-1 text-muted-foreground">{summary.skipped} omitidos</span>
      {summary.failed > 0 && <span className="rounded-md bg-destructive/10 px-2 py-1 text-destructive">{summary.failed} fallaron</span>}
      <span className="rounded-md bg-muted px-2 py-1 text-muted-foreground">{summary.total} total</span>
    </div>
  )
}

function ExportSummaryBadges({ summary }: { summary: ExportSummary }) {
  return (
    <div className="flex flex-wrap gap-2 text-xs">
      <span className="rounded-md bg-tertiary/10 px-2 py-1 text-tertiary">{summary.created} creados</span>
      {summary.updated > 0 && <span className="rounded-md bg-primary/10 px-2 py-1 text-primary">{summary.updated} actualizados</span>}
      <span className="rounded-md bg-muted px-2 py-1 text-muted-foreground">{summary.skipped} omitidos</span>
      {summary.failed > 0 && <span className="rounded-md bg-destructive/10 px-2 py-1 text-destructive">{summary.failed} fallaron</span>}
      <span className="rounded-md bg-muted px-2 py-1 text-muted-foreground">{summary.total} total</span>
    </div>
  )
}

function ErrorList({ errors }: { errors: string[] }) {
  return (
    <details className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
      <summary className="cursor-pointer text-xs font-medium text-destructive">
        {errors.length} error{errors.length !== 1 ? "es" : ""}
      </summary>
      <ul className="mt-2 space-y-1">
        {errors.map((err, i) => (
          <li key={i} className="font-mono text-[11px] text-destructive break-all">{err}</li>
        ))}
      </ul>
    </details>
  )
}
