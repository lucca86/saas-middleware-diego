import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Mail, Phone } from "lucide-react"
import { requireTenant } from "@/lib/tenant/context"
import { createClient } from "@/lib/supabase/server"
import {
  ORDER_STATUS_LABEL,
  type Order,
  type OrderItem,
  type OrderStatus,
} from "@/lib/orders/types"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { formatPrice } from "@/lib/storefront/utils"
import { OrderStatusActions } from "@/components/orders/order-status-actions"

export const metadata: Metadata = {
  title: "Pedido",
}

const STATUS_BADGE: Record<OrderStatus, string> = {
  pending: "border-warning/30 bg-warning/15 text-warning-foreground",
  confirmed: "border-primary/30 bg-primary/15 text-primary",
  fulfilled: "border-success/30 bg-success/15 text-success",
  cancelled: "border-muted bg-muted text-muted-foreground",
}

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ tenant: string; id: string }>
}) {
  const { tenant: tenantSlug, id } = await params
  const { tenant, role } = await requireTenant(tenantSlug)

  const supabase = await createClient()
  const { data: order } = await supabase
    .from("orders")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", tenant.id)
    .maybeSingle<Order>()
  if (!order) notFound()

  const { data: items } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", order.id)
    .order("created_at", { ascending: true })
  const orderItems = (items ?? []) as unknown as OrderItem[]

  const canManage = ["owner", "admin", "operator"].includes(role)

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={`/app/${tenantSlug}/orders`}
        className="flex w-fit items-center gap-1 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" />
        Pedidos
      </Link>

      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Pedido · {new Date(order.created_at).toLocaleString("es-AR")}
          </p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight md:text-4xl">
            {order.code}
          </h1>
        </div>
        <Badge variant="outline" className={STATUS_BADGE[order.status]}>
          {ORDER_STATUS_LABEL[order.status]}
        </Badge>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardContent className="p-6">
            <h2 className="font-display text-base font-semibold tracking-tight">
              Productos
            </h2>
            <ul className="mt-4 divide-y divide-border">
              {orderItems.map((it) => {
                const variantLabel = Object.values(it.variant_attrs ?? {})
                  .filter(Boolean)
                  .join(" / ")
                return (
                  <li key={it.id} className="flex justify-between gap-4 py-4">
                    <div>
                      <p className="font-medium">{it.product_name}</p>
                      {variantLabel ? (
                        <p className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                          {variantLabel}
                        </p>
                      ) : null}
                      {it.variant_sku ? (
                        <p className="mt-0.5 font-mono text-[11px] text-muted-foreground/70">
                          SKU · {it.variant_sku}
                        </p>
                      ) : null}
                      <p className="mt-1 text-sm text-muted-foreground">
                        {it.qty} × {formatPrice(Number(it.unit_price), order.currency)}
                      </p>
                    </div>
                    <p className="font-mono text-sm font-semibold">
                      {formatPrice(Number(it.line_total), order.currency)}
                    </p>
                  </li>
                )
              })}
            </ul>
            <Separator className="my-4" />
            <div className="flex items-baseline justify-between">
              <span className="font-display text-lg font-semibold">Total</span>
              <span className="font-mono text-2xl font-bold">
                {formatPrice(Number(order.total), order.currency)}
              </span>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardContent className="p-6">
              <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Cliente
              </h2>
              <p className="mt-2 font-display text-base font-semibold">
                {order.customer_name}
              </p>
              <a
                href={`mailto:${order.customer_email}`}
                className="mt-3 flex items-center gap-2 text-sm text-foreground hover:underline"
              >
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                {order.customer_email}
              </a>
              {order.customer_phone ? (
                <a
                  href={`tel:${order.customer_phone}`}
                  className="mt-1 flex items-center gap-2 text-sm text-foreground hover:underline"
                >
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  {order.customer_phone}
                </a>
              ) : null}
              {order.shipping_notes ? (
                <>
                  <Separator className="my-4" />
                  <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    Notas
                  </h3>
                  <p className="mt-2 whitespace-pre-line text-sm text-foreground">
                    {order.shipping_notes}
                  </p>
                </>
              ) : null}
            </CardContent>
          </Card>

          {canManage ? (
            <Card>
              <CardContent className="p-6">
                <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Acciones
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Cambiá el estado del pedido. Cancelar repone el stock automáticamente.
                </p>
                <div className="mt-4">
                  <OrderStatusActions
                    tenantSlug={tenantSlug}
                    orderId={order.id}
                    status={order.status}
                  />
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  )
}
