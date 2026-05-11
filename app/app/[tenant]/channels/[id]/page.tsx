import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, CheckCircle2, ExternalLink } from "lucide-react"
import { requireTenant } from "@/lib/tenant/context"
import { getChannel } from "@/lib/channels/queries"
import { ChannelDetailClient } from "@/components/channels/channel-detail-client"
import { WooCommerceImportCard } from "@/components/channels/woocommerce-import-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

const PROVIDER_LABEL: Record<string, string> = {
  tiendanube: "Tienda Nube",
  woocommerce: "WooCommerce",
  mercadolibre: "Mercado Libre",
  shopify: "Shopify",
}

const STATUS_VARIANT: Record<string, string> = {
  connected: "border-tertiary/30 bg-tertiary/15 text-tertiary",
  disconnected: "border-border bg-muted text-muted-foreground",
  error: "border-destructive/30 bg-destructive/15 text-destructive",
  revoked: "border-destructive/30 bg-destructive/15 text-destructive",
}

const STATUS_LABEL: Record<string, string> = {
  connected: "Conectado",
  disconnected: "Desconectado",
  error: "Error",
  revoked: "Revocado",
}

export default async function ChannelDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string; id: string }>
  searchParams: Promise<{ connected?: string }>
}) {
  const { tenant: slug, id } = await params
  const { connected } = await searchParams
  const { tenant, role } = await requireTenant(slug)
  const channel = await getChannel(tenant.id, id)
  if (!channel) notFound()

  const canManage = ["owner", "admin"].includes(role)
  const meta = channel.metadata as Record<string, unknown>
  const planName = typeof meta.plan_name === "string" ? meta.plan_name : null
  const lang = typeof meta.main_language === "string" ? meta.main_language : null
  const businessName = typeof meta.business_name === "string" ? meta.business_name : null

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <Link
        href={`/app/${slug}/channels`}
        className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" />
        Volver a nodes
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {PROVIDER_LABEL[channel.provider] ?? channel.provider} · {channel.external_id}
          </p>
          <h1 className="font-display text-3xl font-bold text-foreground">
            {channel.display_name ?? `Tienda ${channel.external_id}`}
          </h1>
          {channel.store_url ? (
            <a
              href={channel.store_url.startsWith("http") ? channel.store_url : `https://${channel.store_url}`}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              {channel.store_url}
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : null}
        </div>
        <Badge variant="outline" className={STATUS_VARIANT[channel.status] ?? ""}>
          {channel.status === "connected" ? <CheckCircle2 className="mr-1 h-3 w-3" /> : null}
          {STATUS_LABEL[channel.status] ?? channel.status}
        </Badge>
      </header>

      {connected ? (
        <Card className="border-tertiary/30 bg-tertiary/5">
          <CardContent className="flex items-center gap-2 p-3 text-sm text-tertiary">
            <CheckCircle2 className="h-4 w-4" />
            Conexión completada. La tienda quedó vinculada a este tenant.
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Datos de la tienda</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Field label="Razón social" value={businessName} />
            <Field label="País" value={channel.country} />
            <Field label="Moneda" value={channel.currency} />
            <Field label="Idioma" value={lang} />
            <Field label="Plan" value={planName} />
            <Field
              label="Conectado el"
              value={new Date(channel.connected_at).toLocaleString("es-AR", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            />
            <Field
              label="Última sincronización"
              value={
                channel.last_synced_at
                  ? new Date(channel.last_synced_at).toLocaleString("es-AR", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })
                  : "—"
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Permisos otorgados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {channel.scopes && channel.scopes.length > 0 ? (
              <ul className="flex flex-wrap gap-1.5">
                {channel.scopes.map((s) => (
                  <li
                    key={s}
                    className="rounded-full border border-border bg-muted px-2 py-0.5 font-mono text-[11px] text-foreground"
                  >
                    {s}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">
                Tienda Nube no devolvió scopes específicos para este token.
              </p>
            )}
            {channel.last_error ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                <p className="font-medium">Último error</p>
                <p className="font-mono">{channel.last_error}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {channel.provider === "woocommerce" ? (
        <WooCommerceImportCard
          tenantSlug={slug}
          channelId={channel.id}
          canManage={canManage}
          lastImportAt={
            typeof meta.last_import_at === "string" ? (meta.last_import_at as string) : null
          }
          lastImportSummary={
            (meta.last_import_summary as {
              productsImported: number
              productsSkipped: number
              variantsCreated: number
              imagesUploaded: number
              imagesFailed: number
              errors: string[]
            } | null) ?? null
          }
        />
      ) : null}

      <ChannelDetailClient
        tenantSlug={slug}
        channelId={channel.id}
        canManage={canManage}
        status={channel.status}
      />
    </div>
  )
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/40 py-1.5 last:border-0">
      <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-right text-sm text-foreground">{value || "—"}</span>
    </div>
  )
}
