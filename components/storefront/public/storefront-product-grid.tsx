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

export function StorefrontProductGrid({
  tenantSlug,
  products,
  currency,
  hidePrices,
  hasActiveFilters,
}: Props) {
  if (products.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card/30 px-6 py-16 text-center">
        <Package className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden="true" />
        <p className="mt-4 font-display text-lg font-bold text-foreground">
          No hay productos para mostrar
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {hasActiveFilters
            ? "Ningún producto coincide con tu búsqueda."
            : "Volvé más tarde — esta tienda todavía no tiene productos publicados."}
        </p>
        {hasActiveFilters ? (
          <Link
            href={`/s/${tenantSlug}`}
            className="mt-5 inline-flex items-center rounded-md border border-border bg-card px-4 py-2 text-sm transition hover:border-foreground/40 hover:text-foreground"
          >
            Limpiar filtros
          </Link>
        ) : null}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-6">
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
      className="group block overflow-hidden rounded-lg border border-border bg-card transition hover:border-foreground/30 hover:shadow-lg"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-muted">
        {product.primary_image ? (
          <Image
            src={product.primary_image}
            alt={product.name}
            fill
            sizes="(max-width:768px) 50vw, (max-width:1024px) 33vw, 25vw"
            className="object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <Package className="h-8 w-8" />
          </div>
        )}
        {!product.has_stock ? (
          <span className="absolute left-2 top-2 rounded-sm bg-background/95 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Sin stock
          </span>
        ) : null}
      </div>
      <div className="p-4">
        {product.category_name ? (
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {product.category_name}
          </p>
        ) : null}
        <h3 className="mt-1 line-clamp-2 font-display text-sm font-bold text-foreground">
          {product.name}
        </h3>
        {priceLabel ? (
          <p className="mt-2 font-mono text-sm font-medium text-foreground">{priceLabel}</p>
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
