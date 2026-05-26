"use client"

import { useState, useRef, useCallback } from "react"
import { Upload, Download, CheckCircle2, XCircle, Loader2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { MLCategorySelector } from "./ml-category-selector"

interface SyncSummary {
  total: number
  created?: number
  updated?: number
  imported?: number
  skipped: number
  failed: number
  errors: string[]
}

interface MLSyncCardProps {
  tenantSlug: string
  channelId: string
  tenantId: string
  canManage: boolean
  lastImportAt: string | null
  lastImportSummary: SyncSummary | null
  lastExportAt: string | null
  lastExportSummary: SyncSummary | null
  defaultCategoryId: string | null
  defaultCategoryName?: string | null
  siteId?: string
}

interface ProgressState {
  running: boolean
  current: number
  total: number
  label: string
  action?: string
  done: boolean
  error: string | null
  summary: SyncSummary | null
}

const IDLE: ProgressState = {
  running: false, current: 0, total: 0, label: "", done: false, error: null, summary: null,
}

function useSSESync(endpoint: string) {
  const [state, setState] = useState<ProgressState>(IDLE)
  const esRef = useRef<EventSource | null>(null)

  const start = useCallback((url: string) => {
    esRef.current?.close()
    setState({ ...IDLE, running: true })

    const es = new EventSource(url)
    esRef.current = es

    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data) as {
          type: string
          current?: number
          total?: number
          productName?: string
          title?: string
          itemId?: string
          action?: string
          summary?: SyncSummary
          error?: string
        }

        if (msg.type === "progress") {
          setState((prev) => ({
            ...prev,
            current: msg.current ?? prev.current,
            total: msg.total ?? prev.total,
            label: msg.productName ?? msg.title ?? msg.itemId ?? prev.label,
            action: msg.action,
          }))
        } else if (msg.type === "done") {
          setState({ running: false, current: msg.summary?.total ?? 0, total: msg.summary?.total ?? 0, label: "", done: true, error: null, summary: msg.summary ?? null })
          es.close()
        } else if (msg.type === "error") {
          setState((prev) => ({ ...prev, running: false, error: msg.error ?? "Error desconocido" }))
          es.close()
        }
      } catch { /* ignore malformed */ }
    }

    es.onerror = () => {
      setState((prev) => ({ ...prev, running: false, error: "Conexión interrumpida" }))
      es.close()
    }
  }, [])

  const reset = useCallback(() => setState(IDLE), [])

  return { state, start, reset }
}

export function MercadoLibreSyncCard({
  tenantSlug,
  channelId,
  tenantId,
  canManage,
  lastImportAt,
  lastImportSummary,
  lastExportAt,
  lastExportSummary,
  defaultCategoryId,
  defaultCategoryName = null,
  siteId = "MLA",
}: MLSyncCardProps) {
  const exportSync = useSSESync("/api/channels/mercadolibre/export")
  const importSync = useSSESync("/api/channels/mercadolibre/import")

  // Local state so saving category updates button without page reload
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(defaultCategoryId)
  const [activeCategoryName, setActiveCategoryName] = useState<string | null>(defaultCategoryName)

  function startExport() {
    exportSync.start(
      `/api/channels/mercadolibre/export?channelId=${channelId}&tenantId=${tenantId}`,
    )
  }

  function startImport() {
    importSync.start(
      `/api/channels/mercadolibre/import?channelId=${channelId}&tenantId=${tenantId}`,
    )
  }

  const exportPct = exportSync.state.total > 0
    ? Math.round((exportSync.state.current / exportSync.state.total) * 100)
    : 0

  const importPct = importSync.state.total > 0
    ? Math.round((importSync.state.current / importSync.state.total) * 100)
    : 0

  return (
    <div className="flex flex-col gap-4">

      {/* ── Export SC → ML ───────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Upload className="h-4 w-4 text-muted-foreground" />
            Publicar en MercadoLibre
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <MLCategorySelector
            tenantSlug={tenantSlug}
            channelId={channelId}
            siteId={siteId}
            currentCategoryId={activeCategoryId}
            currentCategoryName={activeCategoryName}
            canManage={canManage}
            onSaved={(id, name) => {
              setActiveCategoryId(id)
              setActiveCategoryName(name)
            }}
          />

          {!activeCategoryId && (
            <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-400">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Necesitás configurar una <strong>categoría ML por defecto</strong> antes de publicar.
              </span>
            </div>
          )}

          {!exportSync.state.running && !exportSync.state.done && (
            <div className="text-xs text-muted-foreground">
              {lastExportAt ? (
                <p>
                  Última publicación:{" "}
                  <span className="text-foreground">
                    {new Date(lastExportAt).toLocaleString("es-AR")}
                  </span>
                  {lastExportSummary && (
                    <span className="ml-2">
                      — {lastExportSummary.created ?? 0} creados,{" "}
                      {lastExportSummary.updated ?? 0} actualizados,{" "}
                      {lastExportSummary.failed} fallaron
                    </span>
                  )}
                </p>
              ) : (
                <p>Nunca publicado. Publicá tu catálogo en MercadoLibre.</p>
              )}
            </div>
          )}

          {exportSync.state.running && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="truncate max-w-[60%]">{exportSync.state.label || "Iniciando…"}</span>
                <span>{exportSync.state.current}/{exportSync.state.total}</span>
              </div>
              <Progress value={exportPct} className="h-1.5" />
            </div>
          )}

          {exportSync.state.done && exportSync.state.summary && (
            <SyncResult summary={exportSync.state.summary} onReset={exportSync.reset} mode="export" />
          )}

          {exportSync.state.error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
              <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{exportSync.state.error}</span>
            </div>
          )}

          {!exportSync.state.running && !exportSync.state.done && (
            <Button
              onClick={startExport}
              disabled={!canManage || !activeCategoryId}
              className="w-full"
              size="sm"
            >
              <Upload className="mr-1.5 h-3.5 w-3.5" />
              {lastExportAt ? "Re-publicar catálogo" : "Publicar catálogo"}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* ── Import ML → SC ───────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Download className="h-4 w-4 text-muted-foreground" />
            Importar desde MercadoLibre
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">

          {!importSync.state.running && !importSync.state.done && (
            <div className="text-xs text-muted-foreground">
              {lastImportAt ? (
                <p>
                  Última importación:{" "}
                  <span className="text-foreground">
                    {new Date(lastImportAt).toLocaleString("es-AR")}
                  </span>
                  {lastImportSummary && (
                    <span className="ml-2">
                      — {lastImportSummary.imported ?? 0} importados,{" "}
                      {lastImportSummary.failed} fallaron
                    </span>
                  )}
                </p>
              ) : (
                <p>Importá tus publicaciones activas de MercadoLibre al catálogo.</p>
              )}
            </div>
          )}

          {importSync.state.running && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="truncate max-w-[60%]">{importSync.state.label || "Iniciando…"}</span>
                <span>{importSync.state.current}/{importSync.state.total}</span>
              </div>
              <Progress value={importPct} className="h-1.5" />
            </div>
          )}

          {importSync.state.done && importSync.state.summary && (
            <SyncResult summary={importSync.state.summary} onReset={importSync.reset} mode="import" />
          )}

          {importSync.state.error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
              <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{importSync.state.error}</span>
            </div>
          )}

          {!importSync.state.running && !importSync.state.done && (
            <Button
              onClick={startImport}
              disabled={!canManage}
              variant="outline"
              className="w-full"
              size="sm"
            >
              {importSync.state.running ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="mr-1.5 h-3.5 w-3.5" />
              )}
              {lastImportAt ? "Re-importar publicaciones" : "Importar publicaciones"}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function SyncResult({
  summary,
  onReset,
  mode,
}: {
  summary: SyncSummary
  onReset: () => void
  mode: "import" | "export"
}) {
  const hasErrors = summary.errors.length > 0
  const [showErrors, setShowErrors] = useState(false)

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm">
        {hasErrors && summary.failed === summary.total ? (
          <XCircle className="h-4 w-4 text-destructive" />
        ) : (
          <CheckCircle2 className="h-4 w-4 text-green-500" />
        )}
        <span className="font-medium">Sincronización completa</span>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        {mode === "export" ? (
          <>
            <Badge variant="outline">{summary.created ?? 0} creados</Badge>
            <Badge variant="outline">{summary.updated ?? 0} actualizados</Badge>
          </>
        ) : (
          <Badge variant="outline">{summary.imported ?? 0} importados</Badge>
        )}
        <Badge variant="outline">{summary.skipped} omitidos</Badge>
        {summary.failed > 0 && (
          <Badge variant="destructive">{summary.failed} fallaron</Badge>
        )}
      </div>

      {hasErrors && (
        <div>
          <button
            onClick={() => setShowErrors((v) => !v)}
            className="text-xs text-muted-foreground underline underline-offset-2"
          >
            {showErrors ? "Ocultar errores" : `Ver ${summary.errors.length} errores`}
          </button>
          {showErrors && (
            <ul className="mt-2 max-h-32 overflow-y-auto space-y-1">
              {summary.errors.map((e, i) => (
                <li key={i} className="text-xs text-destructive">{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <Button size="sm" variant="outline" onClick={onReset} className="w-full">
        Nueva sincronización
      </Button>
    </div>
  )
}
