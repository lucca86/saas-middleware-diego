"use client"

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
  Package,
  ShoppingCart,
  Webhook,
  RefreshCw,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { SyncLogEntry } from "@/lib/channels/sync-log-queries"

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  ok: {
    icon: CheckCircle2,
    label: "OK",
    className: "border-tertiary/30 bg-tertiary/10 text-tertiary",
  },
  partial: {
    icon: AlertTriangle,
    label: "Parcial",
    className: "border-yellow-500/30 bg-yellow-500/10 text-yellow-600",
  },
  error: {
    icon: XCircle,
    label: "Error",
    className: "border-destructive/30 bg-destructive/10 text-destructive",
  },
  skipped: {
    icon: SkipForward,
    label: "Omitido",
    className: "border-border bg-muted text-muted-foreground",
  },
} as const

// ─── Event type label + icon ──────────────────────────────────────────────────

const EVENT_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; dirIcon: React.ElementType }
> = {
  import: {
    label: "Import WC → SC",
    icon: ArrowDownToLine,
    dirIcon: ArrowDownToLine,
  },
  push_product: {
    label: "Push producto",
    icon: Package,
    dirIcon: ArrowUpFromLine,
  },
  push_stock: {
    label: "Push stock",
    icon: Package,
    dirIcon: ArrowUpFromLine,
  },
  webhook_order: {
    label: "Pedido webhook",
    icon: ShoppingCart,
    dirIcon: ArrowDownToLine,
  },
  webhook_product: {
    label: "Producto webhook",
    icon: Webhook,
    dirIcon: ArrowDownToLine,
  },
  connect: {
    label: "Conexión",
    icon: RefreshCw,
    dirIcon: ArrowDownToLine,
  },
  error: {
    label: "Error",
    icon: XCircle,
    dirIcon: ArrowDownToLine,
  },
}

// ─── Filter tabs ──────────────────────────────────────────────────────────────

const FILTERS = [
  { value: null, label: "Todos" },
  { value: "ok", label: "OK" },
  { value: "partial", label: "Parciales" },
  { value: "error", label: "Errores" },
]

// ─── Main component ───────────────────────────────────────────────────────────

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

  function buildHref(p: number, s: string | null) {
    const params = new URLSearchParams()
    if (p > 1) params.set("page", String(p))
    if (s) params.set("status", s)
    const qs = params.toString()
    return qs ? `${base}?${qs}` : base
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {FILTERS.slice(1).map((f) => {
          const count = rows.filter((r) => f.value === null || r.status === f.value).length
          const cfg = STATUS_CONFIG[f.value as keyof typeof STATUS_CONFIG]
          const Icon = cfg?.icon ?? CheckCircle2
          return (
            <Link key={f.value} href={buildHref(1, f.value)}>
              <Card
                className={`cursor-pointer transition-colors hover:border-primary/40 ${
                  activeStatus === f.value ? "border-primary/60 bg-primary/5" : ""
                }`}
              >
                <CardContent className="flex items-center gap-3 p-4">
                  <Icon className={`h-5 w-5 ${cfg?.className?.includes("text-") ? cfg.className.split(" ").find((c) => c.startsWith("text-")) : "text-muted-foreground"}`} />
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                      {f.label}
                    </p>
                    <p className="text-xl font-bold tabular-nums text-foreground">{count}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      {/* Filter tabs */}
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

      {/* Table */}
      {rows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
            <RefreshCw className="h-8 w-8 opacity-30" />
            <p className="text-sm">No hay eventos de sincronización registrados todavía.</p>
            <p className="text-xs">
              Los eventos aparecen aquí cada vez que se importa, se hace push de un producto, o
              llega un webhook de WooCommerce.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
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
              <tbody className="divide-y divide-border/50">
                {rows.map((row) => {
                  const evtCfg = EVENT_CONFIG[row.event_type] ?? EVENT_CONFIG.error
                  const EvtIcon = evtCfg.icon
                  const DirIcon = evtCfg.dirIcon
                  const stCfg = STATUS_CONFIG[row.status]
                  const StIcon = stCfg.icon
                  const isError = row.status === "error"

                  return (
                    <tr
                      key={row.id}
                      className={`transition-colors hover:bg-muted/20 ${isError ? "bg-destructive/5" : ""}`}
                    >
                      {/* Event type */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <EvtIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
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
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <DirIcon className="h-3.5 w-3.5" />
                          <span className="font-mono text-[10px]">
                            {row.direction === "sc_to_channel" ? "SC → WC" : "WC → SC"}
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={`gap-1 ${stCfg.className}`}>
                          <StIcon className="h-3 w-3" />
                          {stCfg.label}
                        </Badge>
                      </td>

                      {/* Summary */}
                      <td className="max-w-xs px-4 py-3">
                        <p className="line-clamp-2 text-xs text-muted-foreground">
                          {row.summary ?? "—"}
                        </p>
                        {/* Show error payload details if error */}
                        {isError && row.payload && Object.keys(row.payload).length > 0 ? (
                          <details className="mt-1">
                            <summary className="cursor-pointer font-mono text-[10px] text-destructive hover:underline">
                              Ver detalle
                            </summary>
                            <pre className="mt-1 max-h-24 overflow-auto rounded bg-destructive/5 p-1.5 font-mono text-[10px] text-destructive">
                              {JSON.stringify(row.payload, null, 2)}
                            </pre>
                          </details>
                        ) : null}
                      </td>

                      {/* Date */}
                      <td className="hidden whitespace-nowrap px-4 py-3 text-right md:table-cell">
                        <ClientDate iso={row.created_at} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Pagination */}
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

/** Renders the date client-side to avoid hydration mismatches with TZ. */
function ClientDate({ iso }: { iso: string }) {
  return (
    <span
      suppressHydrationWarning
      className="font-mono text-[11px] text-muted-foreground"
    >
      {typeof window === "undefined"
        ? iso
        : new Intl.DateTimeFormat("es-AR", {
            dateStyle: "short",
            timeStyle: "short",
          }).format(new Date(iso))}
    </span>
  )
}
