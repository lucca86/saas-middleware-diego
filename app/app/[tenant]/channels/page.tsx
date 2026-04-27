import Link from "next/link"
import { CheckCircle2, Plus, ShoppingBag, AlertCircle } from "lucide-react"
import { requireTenant } from "@/lib/tenant/context"
import { listChannels } from "@/lib/channels/queries"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"

const PROVIDER_LABEL: Record<string, string> = {
  tiendanube: "Tienda Nube",
  mercadolibre: "Mercado Libre",
  shopify: "Shopify",
  custom: "Custom",
}

const STATUS_VARIANT: Record<string, string> = {
  connected: "bg-tertiary/15 text-tertiary border-tertiary/30",
  disconnected: "bg-muted text-muted-foreground border-border",
  error: "bg-destructive/15 text-destructive border-destructive/30",
  revoked: "bg-destructive/15 text-destructive border-destructive/30",
}

const STATUS_LABEL: Record<string, string> = {
  connected: "Conectado",
  disconnected: "Desconectado",
  error: "Error",
  revoked: "Revocado",
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
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Canales conectados
          </p>
          <h1 className="font-display text-3xl font-bold text-foreground">Nodes</h1>
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">
            Cada node es un canal de venta conectado al stock de este tenant: storefronts, marketplaces, feeds.
            Tienda Nube es el primer provider soportado.
          </p>
        </div>
        <Button asChild className="shadow-signal">
          <Link href={`/app/${slug}/channels/new`}>
            <Plus className="mr-1.5 h-4 w-4" />
            Deploy New Node
          </Link>
        </Button>
      </header>

      {error ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" aria-hidden />
            <div className="text-sm">
              <p className="font-medium text-destructive">No se pudo completar la conexión</p>
              <p className="text-muted-foreground">Detalle: {error}</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

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
          {channels.map((c) => (
            <Card key={c.id} className="card-accent-primary">
              <CardHeader className="space-y-1.5 pb-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    {PROVIDER_LABEL[c.provider] ?? c.provider}
                  </p>
                  <Badge variant="outline" className={STATUS_VARIANT[c.status] ?? ""}>
                    {c.status === "connected" ? (
                      <CheckCircle2 className="mr-1 h-3 w-3" aria-hidden />
                    ) : null}
                    {STATUS_LABEL[c.status] ?? c.status}
                  </Badge>
                </div>
                <CardTitle className="text-lg">{c.display_name ?? `Tienda ${c.external_id}`}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-0 text-sm text-muted-foreground">
                {c.store_url ? (
                  <p className="font-mono text-xs text-foreground/80">{c.store_url}</p>
                ) : null}
                <div className="flex items-center gap-3 text-xs">
                  {c.country ? <span>{c.country}</span> : null}
                  {c.currency ? <span>· {c.currency}</span> : null}
                  <span>· #{c.external_id}</span>
                </div>
                <div className="pt-2">
                  <Button asChild variant="outline" size="sm" className="w-full">
                    <Link href={`/app/${slug}/channels/${c.id}`}>Administrar</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
