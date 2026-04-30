import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { getPublicTenant } from "@/lib/storefront/queries"
import { cartCount, cartSubtotal, readCart } from "@/lib/cart/cookie"
import { formatPrice } from "@/lib/storefront/utils"
import { CheckoutForm } from "@/components/storefront/public/storefront-checkout-form"
import { Separator } from "@/components/ui/separator"

export const dynamic = "force-dynamic"

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>
}) {
  const { tenantSlug } = await params
  const tenant = await getPublicTenant(tenantSlug)
  if (!tenant) notFound()

  const cart = await readCart(tenantSlug)
  if (cart.lines.length === 0) {
    redirect(`/s/${tenantSlug}/cart`)
  }
  const subtotal = cartSubtotal(cart)
  const count = cartCount(cart)

  return (
    <section className="mx-auto max-w-6xl px-4 py-10 md:px-8 md:py-14">
      <header className="mb-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          <Link
            href={`/s/${tenantSlug}/cart`}
            className="text-muted-foreground hover:text-foreground"
          >
            Bolsa
          </Link>
          <span className="mx-2">·</span>
          <span className="text-foreground">Checkout</span>
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-[-0.01em] md:text-5xl">
          Finalizar pedido
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Completá tus datos y la tienda te va a contactar para coordinar pago y
          envío. Todavía no se cobra nada.
        </p>
      </header>

      <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
        <CheckoutForm tenantSlug={tenantSlug} />

        <aside className="self-start rounded-lg border border-border bg-card/40 p-6 lg:sticky lg:top-28">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            Resumen · {count} {count === 1 ? "producto" : "productos"}
          </h2>
          <ul className="mt-4 divide-y divide-border">
            {cart.lines.map((line) => {
              const variantLabel = Object.values(line.variantAttrs)
                .filter(Boolean)
                .join(" / ")
              return (
                <li key={line.variantId} className="flex justify-between gap-3 py-3 text-sm">
                  <div>
                    <p className="font-medium leading-tight">
                      {line.productName}
                      <span className="ml-1 text-muted-foreground">× {line.qty}</span>
                    </p>
                    {variantLabel ? (
                      <p className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                        {variantLabel}
                      </p>
                    ) : null}
                  </div>
                  <p className="font-mono text-sm">
                    {formatPrice(line.unitPrice * line.qty, tenant.currency)}
                  </p>
                </li>
              )
            })}
          </ul>
          <Separator className="my-4" />
          <div className="flex items-baseline justify-between">
            <span className="font-display text-base font-semibold">Total</span>
            <span className="font-mono text-xl font-bold">
              {formatPrice(subtotal, tenant.currency)}
            </span>
          </div>
        </aside>
      </div>
    </section>
  )
}
