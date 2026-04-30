import Link from "next/link"
import Image from "next/image"
import { ArrowRight } from "lucide-react"
import { formatPrice } from "@/lib/storefront/utils"
import type { PublicProductCard } from "@/lib/storefront/types"

interface Props {
  tenantSlug: string
  products: PublicProductCard[]
  currency: string
  hidePrices?: boolean
}

/**
 * Editorial featured shelf shown on the home above the main grid. We use
 * an asymmetric layout: a big lead product on the left, three secondary
 * products in a vertical column on the right. Falls back to a clean grid
 * if there aren't enough products for the lead layout.
 */
export function StorefrontFeatured({
  tenantSlug,
  products,
  currency,
  hidePrices,
}: Props) {
  if (products.length === 0) return null

  const [lead, ...rest] = products
  const secondary = rest.slice(0, 3)
  const useLeadLayout = products.length >= 4

  return (
    <section className="border-b border-border/40 py-12 md:py-20">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <div className="mb-8 flex items-end justify-between gap-4 md:mb-12">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
              Selección
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-[-0.01em] text-foreground md:text-5xl">
              Lo nuevo de la temporada
            </h2>
          </div>
          <Link
            href={`/s/${tenantSlug}#catalogo`}
            className="hidden items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] text-foreground transition hover:text-muted-foreground md:flex"
          >
            Ver todo
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {useLeadLayout ? (
          <div className="grid gap-6 md:grid-cols-2 md:gap-8">
            <FeaturedHero tenantSlug={tenantSlug} product={lead} currency={currency} hidePrices={hidePrices} />
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 md:grid-cols-1">
              {secondary.map((p) => (
                <FeaturedRow
                  key={p.id}
                  tenantSlug={tenantSlug}
                  product={p}
                  currency={currency}
                  hidePrices={hidePrices}
                />
              ))}
            </div>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4 md:gap-x-6">
            {products.map((p) => (
              <li key={p.id}>
                <FeaturedSquare
                  tenantSlug={tenantSlug}
                  product={p}
                  currency={currency}
                  hidePrices={hidePrices}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

function FeaturedHero({
  tenantSlug,
  product,
  currency,
  hidePrices,
}: {
  tenantSlug: string
  product: PublicProductCard
  currency: string
  hidePrices?: boolean
}) {
  return (
    <Link href={`/s/${tenantSlug}/p/${product.slug}`} className="group block">
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-muted md:aspect-[3/4]">
        {product.primary_image ? (
          <Image
            src={product.primary_image}
            alt={product.name}
            fill
            sizes="(max-width:768px) 100vw, 50vw"
            className="object-cover transition duration-700 ease-out group-hover:scale-[1.03]"
            priority
          />
        ) : null}
      </div>
      <div className="mt-4">
        {product.category_name ? (
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            {product.category_name}
          </p>
        ) : null}
        <h3 className="mt-1.5 font-display text-2xl font-semibold tracking-[-0.01em] text-foreground decoration-foreground/40 underline-offset-4 group-hover:underline md:text-3xl">
          {product.name}
        </h3>
        {!hidePrices && product.min_price !== null ? (
          <p className="mt-1.5 font-mono text-base tabular-nums text-foreground">
            {product.max_price && product.max_price !== product.min_price
              ? `Desde ${formatPrice(product.min_price, currency)}`
              : formatPrice(product.min_price, currency)}
          </p>
        ) : null}
      </div>
    </Link>
  )
}

function FeaturedRow({
  tenantSlug,
  product,
  currency,
  hidePrices,
}: {
  tenantSlug: string
  product: PublicProductCard
  currency: string
  hidePrices?: boolean
}) {
  return (
    <Link
      href={`/s/${tenantSlug}/p/${product.slug}`}
      className="group flex items-center gap-4 border-b border-border/60 pb-6 last:border-0 last:pb-0 md:py-2"
    >
      <div className="relative aspect-square h-24 w-24 flex-shrink-0 overflow-hidden bg-muted md:h-28 md:w-28">
        {product.primary_image ? (
          <Image
            src={product.primary_image}
            alt={product.name}
            fill
            sizes="112px"
            className="object-cover transition duration-500 group-hover:scale-[1.05]"
          />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        {product.category_name ? (
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            {product.category_name}
          </p>
        ) : null}
        <h3 className="mt-1 line-clamp-2 font-display text-base font-semibold leading-snug text-foreground decoration-foreground/40 underline-offset-4 group-hover:underline">
          {product.name}
        </h3>
        {!hidePrices && product.min_price !== null ? (
          <p className="mt-1 font-mono text-sm tabular-nums text-muted-foreground">
            {product.max_price && product.max_price !== product.min_price
              ? `Desde ${formatPrice(product.min_price, currency)}`
              : formatPrice(product.min_price, currency)}
          </p>
        ) : null}
      </div>
    </Link>
  )
}

function FeaturedSquare({
  tenantSlug,
  product,
  currency,
  hidePrices,
}: {
  tenantSlug: string
  product: PublicProductCard
  currency: string
  hidePrices?: boolean
}) {
  return (
    <Link href={`/s/${tenantSlug}/p/${product.slug}`} className="group block">
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-muted">
        {product.primary_image ? (
          <Image
            src={product.primary_image}
            alt={product.name}
            fill
            sizes="(max-width:768px) 50vw, 25vw"
            className="object-cover transition duration-500 group-hover:scale-[1.04]"
          />
        ) : null}
      </div>
      <div className="mt-3">
        <h3 className="line-clamp-1 font-display text-sm font-semibold text-foreground decoration-foreground/40 underline-offset-4 group-hover:underline">
          {product.name}
        </h3>
        {!hidePrices && product.min_price !== null ? (
          <p className="mt-0.5 font-mono text-xs tabular-nums text-muted-foreground">
            {product.max_price && product.max_price !== product.min_price
              ? `Desde ${formatPrice(product.min_price, currency)}`
              : formatPrice(product.min_price, currency)}
          </p>
        ) : null}
      </div>
    </Link>
  )
}
