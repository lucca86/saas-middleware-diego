"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Package,
  ShoppingCart,
  Webhook,
  RefreshCw,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { SyncLogEntry } from "@/lib/channels/sync-log-queries"

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  ok: {
    icon: CheckCircle2,
    label: "OK",
    badge: "border-tertiary/30 bg-tertiary/10 text-tertiary",
    row: "",
  },
  partial: {
    icon: AlertTriangle,
    label: "Parcial",
    badge: "border-yellow-500/30 bg-yellow-500/10 text-yellow-600",
    row: "bg-yellow-500/5",
  },
  error: {
    icon: XCircle,
    label: "Error",
    badge: "border-destructive/30 bg-destructive/10 text-destructive",
    row: "bg-destructive/5",
  },
  skipped: {
    icon: SkipForward,
    label: "Omitido",
    badge: "border-border bg-muted text-muted-foreground",
    row: "",
  },
} as const

// ─── Event config ─────────────────────────────────────────────────────────────

const EVENT_CONFIG: Record<string, { label: string; Icon: React.ElementType; dir: string }> = {
  import: { label: "Import WC → SC", Icon: ArrowDownToLine, dir: "WC → SC" },
  push_product: { label: "Push producto", Icon: Package, dir: "SC → WC" },
  push_stock: { label: "Push stock", Icon: Package, dir: "SC → WC" },
  webhook_order: { label: "Pedido webhook", Icon: ShoppingCart, dir: "WC → SC" },
  webhook_product: { label: "Producto webhook", Icon: Webhook, dir: "WC → SC" },
  connect: { label: "Conexión", Icon: RefreshCw, dir: "—" },
  error: { label: "Error", Icon: XCircle, dir: "—" },
}

const FILTERS = [
  { value: null, label: "Todos" },
  { value: "ok", label: "OK" },
  { value: "partial", label: "Parciales" },
  { value: "error", label: "Errores" },
] as const

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  rows: SyncLogEntry[]
  total: number
  page: number
  totalPages: number
  channelId: string
  tenantSlug: string
  activeStatus: string | null
}

export function SyncLogTable({
  rows,
  total,
  page,
  totalPages,
  channelId,
  tenantSlug,
  activeStatus,
}: Props) {
  const router = useRouter()
  const base = `/app/${tenantSlug}/channels/${channelId}/sync-log`
  const [expanded, setExpanded] = useState<string | null>(null)

  function buildHref(p: number, s: string | null) {
    const params = new URLSearchParams()
    if (p > 1) params.set("page", String(p))
    if (s) params.set("status", s)
    const qs = params.toString()
    return qs ? `${base}?${qs}` : base
  }

  // Stat counts based on ALL rows in current page (server already filtered by status).
  const counts = {
    ok: rows.filter((r) => r.status === "ok").length,
    partial: rows.filter((r) => r.status === "partial").length,
    error: rows.filter((r) => r.status === "error").length,
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ── Stat cards ── */}
      <div className="grid grid-cols-3 gap-3">
        {(["ok", "partial", "error"] as const).map((s) => {
          const cfg = STATUS_CONFIG[s]
          const Icon = cfg.icon
          return (
            <Link key={s} href={buildHref(1, s)}>
              <Card
                className={`cursor-pointer transition-colors hover:border-primary/40 ${
                  activeStatus === s ? "border-primary/60 bg-primary/5" : ""
                }`}
              >
                <CardContent className="flex items-center gap-4 p-5">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${cfg.badge}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      {s === "ok" ? "OK" : s === "partial" ? "Parciales" : "Errores"}
                    </p>
                    <p className="text-2xl font-bold tabular-nums text-foreground">
                      {counts[s]}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      {/* ── Filter tabs ── */}
      <div className="flex items-center gap-1 border-b border-border pb-2">
        {FILTERS.map((f) => (
          <Link
            key={String(f.value)}
            href={buildHref(1, f.value)}
            className={`rounded-md px-3 py-1.5 font-mono text-xs transition-colors ${
              activeStatus === f.value
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}
          </Link>
        ))}
        <span className="ml-auto font-mono text-[11px] text-muted-foreground">
          {total} evento{total !== 1 ? "s" : ""}
        </span>
      </div>

      {/* ── Table ── */}
      {rows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
            <RefreshCw className="h-8 w-8 opacity-30" />
            <p className="text-sm">No hay eventos de sincronización registrados.</p>
            <p className="text-xs">
              Los eventos aparecen aquí cada vez que se importa, se hace push de un producto, o
              llega un webhook de WooCommerce.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="w-8 px-3 py-2.5" />
                <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                  Evento
                </th>
                <th className="hidden px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-wide text-muted-foreground sm:table-cell">
                  Dirección
                </th>
                <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                  Estado
                </th>
                <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                  Resumen
                </th>
                <th className="hidden px-4 py-2.5 text-right font-mono text-[10px] uppercase tracking-wide text-muted-foreground md:table-cell">
                  Fecha
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {rows.map((row) => {
                const evtCfg = EVENT_CONFIG[row.event_type] ?? EVENT_CONFIG.error
                const { Icon } = evtCfg
                const stCfg = STATUS_CONFIG[row.status]
                const StIcon = stCfg.icon
                const isOpen = expanded === row.id
                const hasDetail =
                  row.status !== "ok" &&
                  row.payload &&
                  Object.keys(row.payload).length > 0

                // Extract errors array and counts from payload for a nicer display.
                const payload = row.payload as Record<string, unknown>
                const errorList = Array.isArray(payload?.errors)
                  ? (payload.errors as string[])
                  : []
                const summaryStats = [
                  payload?.total != null && `Total: ${payload.total}`,
                  payload?.imported != null && `Importados: ${payload.imported}`,
                  payload?.skipped != null && `Omitidos: ${payload.skipped}`,
                  payload?.failed != null && `Fallaron: ${payload.failed}`,
                ]
                  .filter(Boolean)
                  .join("  ·  ")

                return (
                  <>
                    <tr
                      key={row.id}
                      className={`transition-colors hover:bg-muted/20 ${stCfg.row}`}
                    >
                      {/* Expand toggle */}
                      <td className="px-3 py-3">
                        {hasDetail ? (
                          <button
                            type="button"
                            onClick={() => setExpanded(isOpen ? null : row.id)}
                            className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-foreground"
                            aria-label={isOpen ? "Colapsar detalle" : "Expandir detalle"}
                          >
                            <ChevronDown
                              className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`}
                            />
                          </button>
                        ) : null}
                      </td>

                      {/* Event */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="font-medium text-foreground">{evtCfg.label}</span>
                        </div>
                        {row.product?.name ? (
                          <p className="mt-0.5 pl-6 font-mono text-[11px] text-muted-foreground">
                            {row.product.name}
                          </p>
                        ) : null}
                      </td>

                      {/* Direction */}
                      <td className="hidden px-4 py-3 sm:table-cell">
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {evtCfg.dir}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={`gap-1 ${stCfg.badge}`}>
                          <StIcon className="h-3 w-3" />
                          {stCfg.label}
                        </Badge>
                      </td>

                      {/* Summary (short) */}
                      <td className="px-4 py-3">
                        <p className="text-xs text-muted-foreground">{row.summary ?? "—"}</p>
                        {hasDetail && !isOpen ? (
                          <button
                            type="button"
                            onClick={() => setExpanded(row.id)}
                            className="mt-0.5 font-mono text-[10px] text-primary hover:underline"
                          >
                            Ver detalle
                          </button>
                        ) : null}
                      </td>

                      {/* Date */}
                      <td className="hidden whitespace-nowrap px-4 py-3 text-right md:table-cell">
                        <ClientDate iso={row.created_at} />
                      </td>
                    </tr>

                    {/* ── Expanded detail row — full width ── */}
                    {isOpen && hasDetail ? (
                      <tr key={`${row.id}-detail`} className={stCfg.row}>
                        <td colSpan={6} className="px-4 pb-4 pt-0">
                          <div className="ml-6 rounded-lg border border-border bg-card p-4">
                            {/* Stats row if import */}
                            {summaryStats ? (
                              <p className="mb-3 font-mono text-xs text-muted-foreground">
                                {summaryStats}
                              </p>
                            ) : null}

                            {/* Error list */}
                            {errorList.length > 0 ? (
                              <div>
                                <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-destructive">
                                  Errores ({errorList.length})
                                </p>
                                <ul className="flex flex-col gap-1.5">
                                  {errorList.map((msg, i) => (
                                    <li
                                      key={i}
                                      className="flex gap-2 rounded-md bg-destructive/5 px-3 py-2 font-mono text-xs text-destructive"
                                    >
                                      <XCircle className="mt-px h-3.5 w-3.5 shrink-0 opacity-70" />
                                      <span className="break-all leading-relaxed">{msg}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ) : (
                              /* Fallback: render remaining payload keys excluding errors/counts */
                              <div>
                                <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                                  Payload
                                </p>
                                <pre className="max-h-48 overflow-auto rounded-md bg-muted/50 p-3 font-mono text-[11px] text-muted-foreground leading-relaxed">
                                  {JSON.stringify(
                                    Object.fromEntries(
                                      Object.entries(payload).filter(
                                        ([k]) =>
                                          !["total", "imported", "skipped", "failed", "errors"].includes(k),
                                      ),
                                    ),
                                    null,
                                    2,
                                  )}
                                </pre>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}

      {/* ── Pagination ── */}
      {totalPages > 1 ? (
        <div className="flex items-center justify-between">
          <p className="font-mono text-xs text-muted-foreground">
            Página {page} de {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => router.push(buildHref(page - 1, activeStatus))}
              className="bg-transparent"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => router.push(buildHref(page + 1, activeStatus))}
              className="bg-transparent"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function ClientDate({ iso }: { iso: string }) {
  return (
    <span suppressHydrationWarning className="font-mono text-[11px] text-muted-foreground">
      {typeof window === "undefined"
        ? iso
        : new Intl.DateTimeFormat("es-AR", {
            dateStyle: "short",
            timeStyle: "short",
          }).format(new Date(iso))}
    </span>
  )
}
