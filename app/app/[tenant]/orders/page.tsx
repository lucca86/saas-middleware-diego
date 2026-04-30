import type { Metadata } from "next"
import Link from "next/link"
import { ChevronRight, Receipt } from "lucide-react"
import { requireTenant } from "@/lib/tenant/context"
import {
  countTenantOrdersByStatus,
  listTenantOrders,
} from "@/lib/orders/queries"
import { ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/orders/types"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { formatPrice } from "@/lib/storefront/utils"

export const metadata: Metadata = {
  title: "Pedidos",
}

const STATUS_BADGE: Record<OrderStatus, string> = {
  pending: "border-warning/30 bg-warning/15 text-warning-foreground",
  confirmed: "border-primary/30 bg-primary/15 text-primary",
  fulfilled: "border-success/30 bg-success/15 text-success",
  cancelled: "border-muted bg-muted text-muted-foreground",
}

export default async function OrdersPage({
  params,
}: {
  params: Promise<{ tenant: string }>
}) {
  const { tenant: tenantSlug } = await params
  const { tenant } = await requireTenant(tenantSlug)

  const [orders, counts] = await Promise.all([
    listTenantOrders(tenant.id),
    countTenantOrdersByStatus(tenant.id),
  ])

  const totalRevenue = orders
    .filter((o) => o.status !== "cancelled")
    .reduce((acc, o) => acc + Number(o.total), 0)

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Comercio
        </p>
        <h1 className="mt-2 font-display text-3xl font-extrabold leading-tight text-foreground text-balance">
          Pedidos
        </h1>
        <p className="mt-2 max-w-2xl text-pretty text-sm text-muted-foreground leading-relaxed">
          Cada pedido del storefront aparece acá con sus ítems, contacto del
          cliente y estado. Confirmá, marcá como entregado o cancelá según el flujo
          que coordines.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Pendientes" value={counts.pending} />
        <StatCard label="Confirmados" value={counts.confirmed} />
        <StatCard label="Entregados" value={counts.fulfilled} />
        <StatCard
          label="Ingresos"
          value={formatPrice(totalRevenue, tenant.currency)}
          mono
        />
      </section>

      {orders.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Receipt />
            </EmptyMedia>
            <EmptyTitle>Todavía no hay pedidos</EmptyTitle>
            <EmptyDescription>
              Cuando un cliente complete un pedido en tu storefront público, va a
              aparecer en esta lista.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Link
              href={`/s/${tenantSlug}`}
              className="text-sm font-medium text-primary hover:underline"
            >
              Ver mi storefront →
            </Link>
          </EmptyContent>
        </Empty>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              {/* The whole row is a link so any click on the order opens the
                  detail page where the team can confirm/fulfill/cancel. We use
                  a `tr` with `Link`s in every cell because nesting an `a`
                  around a `tr` is invalid HTML. */}
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    <th className="px-4 py-3">Pedido</th>
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="w-10 px-4 py-3" aria-hidden />
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => {
                    const href = `/app/${tenantSlug}/orders/${o.id}`
                    const cell = "px-4 py-3 align-middle"
                    return (
                      <tr
                        key={o.id}
                        className="group cursor-pointer border-b border-border last:border-0 transition hover:bg-muted/40 focus-within:bg-muted/40"
                      >
                        <td className={cell}>
                          <Link
                            href={href}
                            className="block font-mono text-sm font-semibold text-foreground transition group-hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                          >
                            {o.code}
                          </Link>
                        </td>
                        <td className={cell}>
                          <Link href={href} className="block focus:outline-none">
                            <p className="font-medium leading-tight">{o.customer_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {o.customer_email}
                            </p>
                          </Link>
                        </td>
                        <td className={`${cell} text-muted-foreground`}>
                          <Link href={href} className="block focus:outline-none">
                            {new Date(o.created_at).toLocaleString("es-AR", {
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </Link>
                        </td>
                        <td className={cell}>
                          <Link href={href} className="block focus:outline-none">
                            <Badge variant="outline" className={STATUS_BADGE[o.status]}>
                              {ORDER_STATUS_LABEL[o.status]}
                            </Badge>
                          </Link>
                        </td>
                        <td className={`${cell} text-right`}>
                          <Link href={href} className="block font-mono focus:outline-none">
                            {formatPrice(Number(o.total), o.currency)}
                          </Link>
                        </td>
                        <td className={`${cell} text-right text-muted-foreground`}>
                          <Link
                            href={href}
                            className="inline-flex items-center justify-center rounded transition group-hover:translate-x-0.5 group-hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            aria-label={`Ver pedido ${o.code}`}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  mono,
}: {
  label: string
  value: number | string
  mono?: boolean
}) {
  return (
    <div className="rounded-lg border border-border bg-card/40 px-4 py-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p
        className={
          mono
            ? "mt-1 font-mono text-lg font-bold"
            : "mt-1 font-display text-2xl font-bold"
        }
      >
        {value}
      </p>
    </div>
  )
}
