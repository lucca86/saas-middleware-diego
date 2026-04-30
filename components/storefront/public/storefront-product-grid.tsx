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
  /** True when the user has any active filter — shown to offer a "reset" CTA. */
  hasActiveFilters?: boolean
}

/**
 * Editorial product grid: tall portrait images, generous gaps, no card
 * chrome. The image carries the visual weight; metadata sits underneath
 * with mono labels and a price line. Hover gently zooms the image and
 * reveals a thin underline on the title — no heavy shadow / border lift.
 */
export function StorefrontProductGrid({
  tenantSlug,
  products,
  currency,
  hidePrices,
  hasActiveFilters,
}: Props) {
  if (products.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card/30 px-6 py-20 text-center">
        <Package className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden="true" />
        <p className="mt-4 font-display text-xl font-bold text-foreground">
          Sin resultados
        </p>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground sm:mx-auto">
          {hasActiveFilters
            ? "Ningún producto coincide con tu búsqueda. Probá ajustar los filtros."
            : "Esta tienda todavía no publicó productos."}
        </p>
        {hasActiveFilters ? (
          <Link
            href={`/s/${tenantSlug}`}
            className="mt-6 inline-flex items-center font-mono text-[11px] uppercase tracking-[0.22em] text-foreground hover:text-muted-foreground"
          >
            Limpiar filtros
          </Link>
        ) : null}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-12 md:grid-cols-3 md:gap-x-6 md:gap-y-16 lg:grid-cols-4 lg:gap-x-8">
      {products.map((p) => (
        <ProductCard
          key={p.id}
          tenantSlug={tenantSlug}
          product={p}
          currency={currency}
          hidePrices={hidePrices}
        />
      ))}
    </div>
  )
}

function ProductCard({
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
  const priceLabel = priceText(product, currency, hidePrices)
  return (
    <Link
      href={`/s/${tenantSlug}/p/${product.slug}`}
      className="group block"
    >
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-muted">
        {product.primary_image ? (
          <Image
            src={product.primary_image}
            alt={product.name}
            fill
            sizes="(max-width:768px) 50vw, (max-width:1024px) 33vw, 25vw"
            className="object-cover transition duration-700 ease-out group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <Package className="h-10 w-10" />
          </div>
        )}
        {!product.has_stock ? (
          <span className="absolute left-3 top-3 rounded-sm bg-background/95 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground backdrop-blur-sm">
            Agotado
          </span>
        ) : null}
      </div>
      <div className="mt-4 px-0.5">
        {product.category_name ? (
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            {product.category_name}
          </p>
        ) : null}
        <h3 className="mt-1 line-clamp-2 font-display text-base font-semibold leading-snug text-foreground decoration-foreground/40 underline-offset-4 group-hover:underline">
          {product.name}
        </h3>
        {priceLabel ? (
          <p className="mt-1.5 font-mono text-sm tabular-nums text-foreground">{priceLabel}</p>
        ) : null}
      </div>
    </Link>
  )
}

function priceText(
  product: PublicProductCard,
  currency: string,
  hidePrices?: boolean,
): string | null {
  if (hidePrices) return null
  if (product.min_price === null) return null
  if (product.max_price !== null && product.max_price !== product.min_price) {
    return `Desde ${formatPrice(product.min_price, currency)}`
  }
  return formatPrice(product.min_price, currency)
}
