import type { Metadata } from "next"
import Link from "next/link"
import { Receipt } from "lucide-react"
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
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    <th className="px-4 py-3">Pedido</th>
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr
                      key={o.id}
                      className="border-b border-border last:border-0 transition hover:bg-muted/40"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/app/${tenantSlug}/orders/${o.id}`}
                          className="font-mono text-sm font-semibold text-foreground hover:underline"
                        >
                          {o.code}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium leading-tight">{o.customer_name}</p>
                        <p className="text-xs text-muted-foreground">{o.customer_email}</p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(o.created_at).toLocaleString("es-AR", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={STATUS_BADGE[o.status]}>
                          {ORDER_STATUS_LABEL[o.status]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {formatPrice(Number(o.total), o.currency)}
                      </td>
                    </tr>
                  ))}
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
