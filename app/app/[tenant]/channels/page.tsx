import Link from "next/link"
import Image from "next/image"
import { Plus, AlertCircle, RefreshCw, Settings, History, ShoppingBag, CheckCircle2, XCircle, WifiOff } from "lucide-react"
import { requireTenant } from "@/lib/tenant/context"
import { listChannels } from "@/lib/channels/queries"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"

export const dynamic = "force-dynamic"

const PROVIDER_LABEL: Record<string, string> = {
  tiendanube: "Tienda Nube",
  mercadolibre: "Mercado Libre",
  shopify: "Shopify",
  woocommerce: "WooCommerce",
  custom: "Custom",
}

const PROVIDER_LOGO: Record<string, string> = {
  tiendanube: "/channels/tiendanube.png",
  mercadolibre: "/channels/mercadolibre-iso.png",
  shopify: "/channels/shopify.png",
  woocommerce: "/channels/woocommerce.png",
}

const PROVIDER_COLOR: Record<string, string> = {
  tiendanube: "bg-sky-500/10 border-sky-500/20",
  mercadolibre: "bg-yellow-500/10 border-yellow-500/20",
  shopify: "bg-green-500/10 border-green-500/20",
  woocommerce: "bg-purple-500/10 border-purple-500/20",
  custom: "bg-muted border-border",
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return "Nunca"
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "Hace un momento"
  if (mins < 60) return `Hace ${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `Hace ${hrs}h`
  return `Hace ${Math.floor(hrs / 24)}d`
}

function StatusBadge({ status, lastError }: { status: string; lastError?: string | null }) {
  if (status === "connected") {
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_2px_rgba(52,211,153,0.5)]" />
        Activo
      </span>
    )
  }
  if (status === "error") {
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium text-destructive">
        <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
        Error
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
      Inactivo
    </span>
  )
}

export default async function ChannelsPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { tenant: slug } = await params
  const { error } = await searchParams
  const { tenant } = await requireTenant(slug)
  const channels = await listChannels(tenant.id)

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Canales conectados
          </p>
          <h1 className="font-display text-3xl font-bold text-foreground">Nodes</h1>
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">
            Cada node es un canal de venta conectado al stock de este tenant: storefronts, marketplaces, feeds.
          </p>
        </div>
        <Button asChild className="shadow-signal">
          <Link href={`/app/${slug}/channels/new`}>
            <Plus className="mr-1.5 h-4 w-4" />
            Deploy New Node
          </Link>
        </Button>
      </header>

      {/* Error banner */}
      {error ? (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
          <div className="text-sm">
            <p className="font-medium text-destructive">No se pudo completar la conexión</p>
            <p className="text-muted-foreground">{error}</p>
          </div>
        </div>
      ) : null}

      {/* Empty state */}
      {channels.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ShoppingBag className="h-6 w-6" aria-hidden />
            </EmptyMedia>
            <EmptyTitle>Todavía no hay nodes conectados</EmptyTitle>
            <EmptyDescription>
              Conectá una tienda para empezar a sincronizar productos y stock.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild>
              <Link href={`/app/${slug}/channels/new`}>
                <Plus className="mr-1.5 h-4 w-4" />
                Conectar mi primera tienda
              </Link>
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {channels.map((c) => {
            const meta = c.metadata ?? {}
            const lastExport = (meta.last_export as { at?: string; summary?: { created?: number; updated?: number; failed?: number } } | undefined)
            const lastImport = (meta.last_import as { at?: string } | undefined)
            const lastSyncAt = c.last_synced_at ?? lastExport?.at ?? lastImport?.at ?? null
            const logo = PROVIDER_LOGO[c.provider]
            const providerColor = PROVIDER_COLOR[c.provider] ?? PROVIDER_COLOR.custom

            return (
              <article
                key={c.id}
                className="group relative flex flex-col rounded-xl border border-border bg-card transition-shadow hover:shadow-lg hover:shadow-black/20"
              >
                {/* Card header */}
                <div className="flex items-start justify-between gap-3 p-4 pb-3">
                  <div className="flex items-center gap-3">
                    {/* Provider logo */}
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${providerColor}`}>
                      {logo ? (
                        <Image
                          src={logo}
                          alt={PROVIDER_LABEL[c.provider] ?? c.provider}
                          width={40}
                          height={40}
                          className="object-contain"
                        />
                      ) : (
                        <ShoppingBag className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                        {PROVIDER_LABEL[c.provider] ?? c.provider}
                      </p>
                      <p className="truncate font-semibold text-foreground leading-tight">
                        {c.display_name ?? `Tienda #${c.external_id}`}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={c.status} lastError={c.last_error} />
                </div>

                {/* Error message */}
                {(c.status === "error" || c.status === "revoked") && c.last_error ? (
                  <div className="mx-4 mb-3 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/8 px-3 py-2 text-xs text-destructive">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span className="line-clamp-2">{c.last_error}</span>
                  </div>
                ) : null}

                {/* Sync stats */}
                <div className="mx-4 mb-3 grid grid-cols-2 gap-px rounded-lg border border-border bg-border overflow-hidden text-xs">
                  <div className="flex flex-col gap-0.5 bg-card px-3 py-2">
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Última sync</span>
                    <span className="font-medium text-foreground">{formatRelativeTime(lastSyncAt)}</span>
                  </div>
                  <div className="flex flex-col gap-0.5 bg-card px-3 py-2">
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Último export</span>
                    <span className="font-medium text-foreground">
                      {lastExport?.summary
                        ? `${lastExport.summary.created ?? 0}C · ${lastExport.summary.updated ?? 0}A · ${lastExport.summary.failed ?? 0}E`
                        : "—"}
                    </span>
                  </div>
                </div>

                {/* Meta info */}
                <div className="mx-4 mb-3 flex items-center gap-2 text-xs text-muted-foreground">
                  {c.store_url ? (
                    <span className="truncate font-mono text-foreground/60">{c.store_url}</span>
                  ) : null}
                  {!c.store_url && (
                    <>
                      {c.country ? <span>{c.country}</span> : null}
                      {c.currency ? <span>· {c.currency}</span> : null}
                      {c.external_id ? <span>· #{c.external_id}</span> : null}
                    </>
                  )}
                </div>

                {/* Divider */}
                <div className="mt-auto border-t border-border" />

                {/* Actions */}
                <div className="grid grid-cols-3 divide-x divide-border">
                  <Link
                    href={`/app/${slug}/channels/${c.id}`}
                    className="flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                  >
                    <Settings className="h-3.5 w-3.5" />
                    Gestionar
                  </Link>
                  <Link
                    href={`/app/${slug}/channels/${c.id}`}
                    className="flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Sync
                  </Link>
                  <Link
                    href={`/app/${slug}/channels/${c.id}/sync-log`}
                    className="flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                  >
                    <History className="h-3.5 w-3.5" />
                    Logs
                  </Link>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
