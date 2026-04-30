import { notFound } from "next/navigation"
import Link from "next/link"
import { CheckCircle2 } from "lucide-react"
import { getPublicTenant } from "@/lib/storefront/queries"
import { getPublicOrderByCode } from "@/lib/orders/queries"
import { ORDER_STATUS_LABEL } from "@/lib/orders/types"
import { formatPrice } from "@/lib/storefront/utils"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

export const dynamic = "force-dynamic"

export default async function OrderSuccessPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; code: string }>
}) {
  const { tenantSlug, code } = await params
  const tenant = await getPublicTenant(tenantSlug)
  if (!tenant) notFound()
  const order = await getPublicOrderByCode(tenantSlug, code)
  if (!order) notFound()

  return (
    <section className="mx-auto max-w-3xl px-4 py-14 md:px-8 md:py-20">
      <div className="text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-success/30 bg-success/10 text-success">
          <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
        </div>
        <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          Pedido recibido · {ORDER_STATUS_LABEL[order.status]}
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-[-0.01em] md:text-5xl">
          Gracias por tu pedido
        </h1>
        <p className="mt-3 max-w-md text-balance text-sm text-muted-foreground sm:mx-auto">
          {order.customer_name.split(" ")[0]}, te enviamos una confirmación a{" "}
          <span className="font-medium text-foreground">{order.customer_email}</span>.
          La tienda se va a contactar para coordinar pago y envío.
        </p>
      </div>

      <div className="mt-10 rounded-lg border border-border bg-card/30 p-6 md:p-8">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            Número de pedido
          </p>
          <p className="font-mono text-sm font-semibold">{order.code}</p>
        </div>
        <Separator className="my-5" />
        <ul className="divide-y divide-border">
          {order.items.map((it) => {
            const variantLabel = Object.values(it.variant_attrs).filter(Boolean).join(" / ")
            return (
              <li key={it.id} className="flex justify-between gap-3 py-3">
                <div>
                  <p className="font-medium leading-tight">
                    {it.product_name}
                    <span className="ml-1 text-muted-foreground">× {it.qty}</span>
                  </p>
                  {variantLabel ? (
                    <p className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      {variantLabel}
                    </p>
                  ) : null}
                </div>
                <p className="font-mono text-sm">
                  {formatPrice(it.line_total, order.currency)}
                </p>
              </li>
            )
          })}
        </ul>
        <Separator className="my-5" />
        <div className="flex items-baseline justify-between">
          <span className="font-display text-lg font-semibold">Total</span>
          <span className="font-mono text-2xl font-bold">
            {formatPrice(order.total, order.currency)}
          </span>
        </div>
      </div>

      <div className="mt-10 flex justify-center">
        <Button asChild variant="outline">
          <Link href={`/s/${tenant.slug}`}>Volver al catálogo</Link>
        </Button>
      </div>
    </section>
  )
}
