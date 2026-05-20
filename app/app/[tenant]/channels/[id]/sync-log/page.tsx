import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { requireTenant } from "@/lib/tenant/context"
import { getChannel } from "@/lib/channels/queries"
import { getSyncLogs } from "@/lib/channels/sync-log-queries"
import { SyncLogTable } from "@/components/channels/sync-log-table"

export default async function SyncLogPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string; id: string }>
  searchParams: Promise<{ page?: string; status?: string }>
}) {
  const { tenant: slug, id } = await params
  const { page: pageStr, status } = await searchParams
  const { tenant } = await requireTenant(slug)
  const channel = await getChannel(tenant.id, id)
  if (!channel) notFound()

  const page = Math.max(1, parseInt(pageStr ?? "1", 10))
  const limit = 50
  const offset = (page - 1) * limit

  const { rows, total } = await getSyncLogs(tenant.id, id, {
    limit,
    offset,
    status: status ?? undefined,
  })

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <Link
        href={`/app/${slug}/channels/${id}`}
        className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" />
        Volver al canal
      </Link>

      <header>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {channel.display_name ?? channel.external_id}
        </p>
        <h1 className="font-display text-3xl font-bold text-foreground">Log de sincronización</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Historial de todos los eventos de sync entre Stockcurve y este canal.
        </p>
      </header>

      <SyncLogTable
        rows={rows}
        total={total}
        page={page}
        totalPages={totalPages}
        channelId={id}
        tenantSlug={slug}
        activeStatus={status ?? null}
      />
    </div>
  )
}
