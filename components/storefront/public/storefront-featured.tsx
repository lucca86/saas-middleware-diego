import Link from "next/link"
import Image from "next/image"
import { Sparkles } from "lucide-react"
import { formatPrice } from "@/lib/storefront/utils"
import type { PublicProductCard } from "@/lib/storefront/types"

interface Props {
  tenantSlug: string
  products: PublicProductCard[]
  currency: string
  hidePrices?: boolean
}

/**
 * Small "Destacados" shelf rendered above the main grid on the home, only
 * when no filter or search is active. The list is intentionally short (4-8)
 * and laid out in a horizontal scroller on mobile, full grid on desktop.
 */
export function StorefrontFeatured({
  tenantSlug,
  products,
  currency,
  hidePrices,
}: Props) {
  if (products.length === 0) return null

  return (
    <section className="border-b border-border/60 bg-card/20 py-10">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <div className="mb-5 flex items-baseline justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              <Sparkles className="mr-1 inline h-3 w-3" aria-hidden="true" />
              Destacados
            </p>
            <h2 className="mt-1 font-display text-2xl font-bold text-foreground">
              Lo más reciente
            </h2>
          </div>
        </div>
        <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:overflow-visible md:px-0">
          <ul className="flex gap-4 md:grid md:grid-cols-4 md:gap-6">
            {products.map((p) => (
              <li
                key={p.id}
                className="w-[180px] flex-shrink-0 md:w-auto"
              >
                <FeaturedCard
                  tenantSlug={tenantSlug}
                  product={p}
                  currency={currency}
                  hidePrices={hidePrices}
                />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

function FeaturedCard({
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
      className="group block"
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-border bg-muted">
        {product.primary_image ? (
          <Image
            src={product.primary_image}
            alt={product.name}
            fill
            sizes="(max-width:768px) 180px, 25vw"
            className="object-cover transition duration-500 group-hover:scale-[1.04]"
          />
        ) : null}
      </div>
      <div className="mt-2">
        <h3 className="line-clamp-1 font-display text-sm font-bold text-foreground">
          {product.name}
        </h3>
        {!hidePrices && product.min_price !== null ? (
          <p className="mt-0.5 font-mono text-xs text-muted-foreground">
            {product.max_price && product.max_price !== product.min_price
              ? `Desde ${formatPrice(product.min_price, currency)}`
              : formatPrice(product.min_price, currency)}
          </p>
        ) : null}
      </div>
    </Link>
  )
}
