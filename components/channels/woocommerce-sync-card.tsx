"use client"

import { useState, useRef, useCallback } from "react"
import { Upload, CheckCircle2, XCircle, AlertTriangle, SkipForward, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

interface ExportSummary {
  total: number
  created: number
  updated: number
  skipped: number
  failed: number
  errors: string[]
}

interface LogEntry {
  message: string
  level: "info" | "warn" | "error"
}

interface ProgressState {
  running: boolean
  current: number
  total: number
  label: string
  action?: string
  done: boolean
  error: string | null
  summary: ExportSummary | null
  log: LogEntry[]
}

const IDLE: ProgressState = {
  running: false,
  current: 0,
  total: 0,
  label: "",
  done: false,
  error: null,
  summary: null,
  log: [],
}

interface Props {
  tenantId: string
  channelId: string
  tenantSlug: string
  canManage: boolean
  lastExportAt: string | null
  lastExportSummary: ExportSummary | null
}

export function WooCommerceSyncCard({
  tenantId,
  channelId,
  tenantSlug,
  canManage,
  lastExportAt,
  lastExportSummary,
}: Props) {
  const [state, setState] = useState<ProgressState>(IDLE)
  const [showLog, setShowLog] = useState(false)
  const esRef = useRef<EventSource | null>(null)

  const start = useCallback(() => {
    esRef.current?.close()
    setState({ ...IDLE, running: true })
    setShowLog(false)

    const es = new EventSource(
      `/api/channels/woocommerce/export?channelId=${channelId}&tenantId=${tenantId}`,
    )
    esRef.current = es

    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data) as {
          type: string
          current?: number
          total?: number
          productName?: string
          action?: string
          message?: string
          level?: "info" | "warn" | "error"
          summary?: ExportSummary
          error?: string
        }

        if (msg.type === "progress") {
          setState((prev) => ({
            ...prev,
            current: msg.current ?? prev.current,
            total: msg.total ?? prev.total,
            label: msg.productName ?? prev.label,
            action: msg.action,
          }))
        } else if (msg.type === "log") {
          setState((prev) => ({
            ...prev,
            log: [
              { message: msg.message ?? "", level: msg.level ?? "info" },
              ...prev.log.slice(0, 49), // keep last 50
            ],
          }))
        } else if (msg.type === "done") {
          setState((prev) => ({
            ...prev,
            running: false,
            current: msg.summary?.total ?? prev.current,
            total: msg.summary?.total ?? prev.total,
            done: true,
            summary: msg.summary ?? null,
          }))
          es.close()
        } else if (msg.type === "error") {
          setState((prev) => ({
            ...prev,
            running: false,
            error: msg.error ?? "Error desconocido",
          }))
          es.close()
        }
      } catch {
        // ignore malformed
      }
    }

    es.onerror = () => {
      setState((prev) => ({ ...prev, running: false, error: "Conexión interrumpida" }))
      es.close()
    }
  }, [channelId, tenantId])

  const reset = useCallback(() => {
    setState(IDLE)
    setShowLog(false)
  }, [])

  const pct =
    state.total > 0 ? Math.round((state.current / state.total) * 100) : 0

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.16em] text-muted-foreground">
          <Upload className="h-4 w-4" />
          Publicar en WooCommerce
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">

        {/* ── Running / done: progress block ── */}
        {(state.running || state.done) && (
          <div className="space-y-2.5 rounded-md border border-border bg-background/40 p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {state.done
                  ? "Sincronización completada"
                  : `Publicando ${state.current} / ${state.total} productos`}
              </span>
              <span className="font-mono font-bold tabular-nums text-foreground">{pct}%</span>
            </div>

            <Progress value={pct} className="h-1.5" />

            {state.running && state.label && (
              <p className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                {state.action === "failed" && (
                  <AlertTriangle className="h-3 w-3 shrink-0 text-destructive" />
                )}
                {state.action === "skipped" && (
                  <SkipForward className="h-3 w-3 shrink-0 text-muted-foreground" />
                )}
                {state.label}
              </p>
            )}

            {/* Live log */}
            {state.log.length > 0 && (
              <div>
                <button
                  type="button"
                  onClick={() => setShowLog((v) => !v)}
                  className="mb-1 text-[11px] text-muted-foreground underline underline-offset-2"
                >
                  {showLog ? "Ocultar log" : `Ver log (${state.log.length})`}
                </button>
                {showLog && (
                  <ul className="max-h-40 space-y-0.5 overflow-y-auto">
                    {state.log.map((entry, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-[11px] leading-snug">
                        {entry.level === "error" ? (
                          <XCircle className="mt-0.5 h-3 w-3 shrink-0 text-destructive" />
                        ) : entry.level === "warn" ? (
                          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
                        ) : (
                          <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-green-500" />
                        )}
                        <span
                          className={
                            entry.level === "error"
                              ? "text-destructive"
                              : entry.level === "warn"
                                ? "text-amber-500"
                                : "text-muted-foreground"
                          }
                        >
                          {entry.message}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Done: summary stats */}
            {state.done && state.summary && (
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 border-t border-border pt-2 font-mono text-xs">
                <span className="text-muted-foreground">Creados</span>
                <span className="text-green-500">{state.summary.created}</span>
                <span className="text-muted-foreground">Actualizados</span>
                <span className="text-foreground">{state.summary.updated}</span>
                <span className="text-muted-foreground">Omitidos</span>
                <span className="text-muted-foreground">{state.summary.skipped}</span>
                {state.summary.failed > 0 && (
                  <>
                    <span className="text-muted-foreground">Fallaron</span>
                    <span className="text-destructive">{state.summary.failed}</span>
                  </>
                )}
              </div>
            )}

            {/* Done: error list */}
            {state.done && state.summary && state.summary.errors.length > 0 && (
              <details className="mt-1">
                <summary className="cursor-pointer select-none text-[11px] text-destructive/80 hover:text-destructive">
                  Ver errores ({state.summary.errors.length})
                </summary>
                <ul className="mt-1.5 max-h-32 space-y-0.5 overflow-y-auto pl-2 text-[11px] text-destructive/80">
                  {state.summary.errors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}

        {/* ── Error block ── */}
        {state.error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
            <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{state.error}</span>
          </div>
        )}

        {/* ── Last export summary (static) ── */}
        {!state.running && !state.done && lastExportSummary && (
          <div className="rounded-md border border-border bg-background/40 p-3 text-xs">
            <p className="mb-2 font-medium text-foreground">Ultimo export</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 font-mono">
              <span className="text-muted-foreground">Creados</span>
              <span className="text-green-500">{lastExportSummary.created}</span>
              <span className="text-muted-foreground">Actualizados</span>
              <span className="text-foreground">{lastExportSummary.updated}</span>
              <span className="text-muted-foreground">Omitidos</span>
              <span className="text-muted-foreground">{lastExportSummary.skipped}</span>
              {lastExportSummary.failed > 0 && (
                <>
                  <span className="text-muted-foreground">Fallaron</span>
                  <span className="text-destructive">{lastExportSummary.failed}</span>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Intro text (first time) ── */}
        {!state.running && !state.done && !lastExportAt && (
          <p className="text-sm text-muted-foreground">
            Publicá tu catálogo de Stockcurve en WooCommerce. Productos, variantes,
            atributos, imágenes, precios y stock se sincronizan automáticamente.
          </p>
        )}

        {/* ── Action buttons ── */}
        {canManage && (
          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
            {!state.done ? (
              <Button
                type="button"
                size="sm"
                disabled={state.running || !canManage}
                onClick={start}
              >
                {state.running ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-1.5 h-4 w-4" />
                )}
                {state.running
                  ? "Publicando…"
                  : lastExportAt
                    ? "Re-publicar catálogo"
                    : "Publicar catálogo"}
              </Button>
            ) : (
              <Button type="button" variant="outline" size="sm" onClick={reset}>
                Nueva sincronización
              </Button>
            )}
          </div>
        )}

        {/* ── Last export timestamp ── */}
        {lastExportAt && !state.running && !state.done && (
          <p className="text-[11px] text-muted-foreground">
            Ultimo export:{" "}
            {new Intl.DateTimeFormat("es-AR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            }).format(new Date(lastExportAt))}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
