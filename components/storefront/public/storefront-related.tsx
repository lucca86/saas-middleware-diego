import Link from "next/link"
import Image from "next/image"
import { Package } from "lucide-react"
import { formatPrice } from "@/lib/storefront/utils"
import type { PublicProductCard } from "@/lib/storefront/types"

interface Props {
  tenantSlug: string
  products: PublicProductCard[]
  currency: string
  hidePrices?: boolean
}

/**
 * "También te puede interesar" rail at the bottom of a PDP. Renders nothing
 * when there are no related products to show.
 */
export function StorefrontRelated({
  tenantSlug,
  products,
  currency,
  hidePrices,
}: Props) {
  if (products.length === 0) return null
  return (
    <section className="mt-16 border-t border-border pt-10">
      <h2 className="font-display text-xl font-bold text-foreground">
        También te puede interesar
      </h2>
      <ul className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
        {products.map((p) => (
          <li key={p.id}>
            <Link
              href={`/s/${tenantSlug}/p/${p.slug}`}
              className="group block overflow-hidden rounded-lg border border-border bg-card transition hover:border-foreground/30 hover:shadow-lg"
            >
              <div className="relative aspect-square w-full overflow-hidden bg-muted">
                {p.primary_image ? (
                  <Image
                    src={p.primary_image}
                    alt={p.name}
                    fill
                    sizes="(max-width:768px) 50vw, 25vw"
                    className="object-cover transition duration-500 group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                    <Package className="h-8 w-8" />
                  </div>
                )}
              </div>
              <div className="p-3">
                <h3 className="line-clamp-2 font-display text-sm font-bold text-foreground">
                  {p.name}
                </h3>
                {!hidePrices && p.min_price !== null ? (
                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    {p.max_price && p.max_price !== p.min_price
                      ? `Desde ${formatPrice(p.min_price, currency)}`
                      : formatPrice(p.min_price, currency)}
                  </p>
                ) : null}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
