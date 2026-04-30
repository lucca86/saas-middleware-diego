import { notFound } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { ArrowRight, ShoppingBag } from "lucide-react"
import { getPublicTenant } from "@/lib/storefront/queries"
import { cartCount, cartSubtotal, readCart } from "@/lib/cart/cookie"
import { formatPrice } from "@/lib/storefront/utils"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { CartLineEditor } from "@/components/storefront/public/storefront-cart-line-editor"

export const dynamic = "force-dynamic"

export default async function CartPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>
}) {
  const { tenantSlug } = await params
  const tenant = await getPublicTenant(tenantSlug)
  if (!tenant) notFound()

  const cart = await readCart(tenantSlug)
  const count = cartCount(cart)
  const subtotal = cartSubtotal(cart)

  if (cart.lines.length === 0) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-20 md:px-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <ShoppingBag className="h-12 w-12 text-muted-foreground" />
          <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
            Tu bolsa está vacía
          </h1>
          <p className="max-w-md text-muted-foreground">
            Explorá el catálogo y sumá productos para empezar a armar tu pedido.
          </p>
          <Button asChild size="lg" className="mt-2">
            <Link href={`/s/${tenant.slug}`}>Volver al catálogo</Link>
          </Button>
        </div>
      </section>
    )
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-10 md:px-8 md:py-14">
      <header className="mb-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          Bolsa
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-[-0.01em] md:text-5xl">
          Tu pedido
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {count} {count === 1 ? "producto" : "productos"} listos para confirmar
        </p>
      </header>

      <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
        <ul className="divide-y divide-border border-y border-border">
          {cart.lines.map((line) => {
            const variantLabel = Object.values(line.variantAttrs)
              .filter(Boolean)
              .join(" / ")
            return (
              <li key={line.variantId} className="flex gap-4 py-6 sm:gap-6">
                <Link
                  href={`/s/${tenant.slug}/p/${line.productSlug}`}
                  className="relative h-28 w-28 flex-shrink-0 overflow-hidden rounded-md border border-border bg-muted sm:h-32 sm:w-32"
                >
                  {line.imageUrl ? (
                    <Image
                      src={line.imageUrl}
                      alt={line.productName}
                      fill
                      sizes="128px"
                      className="object-cover"
                    />
                  ) : null}
                </Link>
                <div className="flex flex-1 flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link
                        href={`/s/${tenant.slug}/p/${line.productSlug}`}
                        className="font-display text-base font-semibold leading-tight text-foreground hover:underline md:text-lg"
                      >
                        {line.productName}
                      </Link>
                      {variantLabel ? (
                        <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                          {variantLabel}
                        </p>
                      ) : null}
                      {line.variantSku ? (
                        <p className="mt-0.5 font-mono text-[11px] text-muted-foreground/70">
                          {line.variantSku}
                        </p>
                      ) : null}
                    </div>
                    <p className="font-mono text-sm font-semibold text-foreground">
                      {formatPrice(line.unitPrice * line.qty, tenant.currency)}
                    </p>
                  </div>
                  <div className="mt-auto pt-4">
                    <CartLineEditor
                      tenantSlug={tenant.slug}
                      variantId={line.variantId}
                      qty={line.qty}
                    />
                  </div>
                </div>
              </li>
            )
          })}
        </ul>

        <aside className="self-start rounded-lg border border-border bg-card/40 p-6 lg:sticky lg:top-28">
          <h2 className="font-display text-lg font-semibold tracking-tight">
            Resumen
          </h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="font-mono">{formatPrice(subtotal, tenant.currency)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Envío</dt>
              <dd className="text-xs text-muted-foreground">A coordinar</dd>
            </div>
          </dl>
          <Separator className="my-5" />
          <div className="flex items-baseline justify-between">
            <span className="font-display text-lg font-semibold">Total</span>
            <span className="font-mono text-2xl font-bold">
              {formatPrice(subtotal, tenant.currency)}
            </span>
          </div>
          <Button asChild size="lg" className="mt-6 w-full">
            <Link href={`/s/${tenant.slug}/checkout`}>
              Finalizar pedido
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="mt-2 w-full">
            <Link href={`/s/${tenant.slug}`}>Seguir comprando</Link>
          </Button>
        </aside>
      </div>
    </section>
  )
}
