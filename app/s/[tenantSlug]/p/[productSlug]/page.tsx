import { notFound } from "next/navigation"
import type { Metadata } from "next"
import {
  getPublicProductBySlug,
  getPublicTenant,
  listRelatedProducts,
} from "@/lib/storefront/queries"
import { StorefrontProductDetail } from "@/components/storefront/public/storefront-product-detail"
import { StorefrontBreadcrumbs } from "@/components/storefront/public/storefront-breadcrumbs"
import { StorefrontRelated } from "@/components/storefront/public/storefront-related"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenantSlug: string; productSlug: string }>
}): Promise<Metadata> {
  const { tenantSlug, productSlug } = await params
  const tenant = await getPublicTenant(tenantSlug)
  if (!tenant) return { title: "Producto no disponible" }
  const detail = await getPublicProductBySlug(tenant.id, productSlug)
  if (!detail) return { title: "Producto no disponible" }

  const description =
    detail.product.description?.slice(0, 160) ??
    `${detail.product.name} en ${tenant.name}.`
  const image = detail.images[0]?.url

  return {
    title: `${detail.product.name} · ${tenant.name}`,
    description,
    openGraph: {
      title: detail.product.name,
      description,
      type: "website",
      images: image ? [image] : undefined,
    },
  }
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; productSlug: string }>
}) {
  const { tenantSlug, productSlug } = await params
  const tenant = await getPublicTenant(tenantSlug)
  if (!tenant) notFound()
  const detail = await getPublicProductBySlug(tenant.id, productSlug)
  if (!detail) notFound()

  const related = await listRelatedProducts(
    tenant.id,
    detail.product.id,
    detail.product.category_id,
    4,
  )

  // Schema.org Product structured data. We give Google the price range across
  // active variants and the availability of the cheapest one. The variant
  // selector still rules the actual cart; this is purely SEO.
  const activeVariants = detail.variants.filter((v) => v.status === "active")
  const prices = activeVariants
    .map((v) => Number(v.price))
    .filter((n) => !Number.isNaN(n))
  const lowPrice = prices.length ? Math.min(...prices) : null
  const highPrice = prices.length ? Math.max(...prices) : null
  const anyInStock = activeVariants.some((v) => (v.stock ?? 0) > 0)

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: detail.product.name,
    description: detail.product.description ?? undefined,
    image: detail.images.map((i) => i.url),
    category: detail.product.category_name ?? undefined,
    brand: tenant.name,
    offers:
      lowPrice !== null
        ? {
            "@type": lowPrice === highPrice ? "Offer" : "AggregateOffer",
            priceCurrency: tenant.currency,
            ...(lowPrice === highPrice
              ? { price: lowPrice }
              : { lowPrice, highPrice, offerCount: activeVariants.length }),
            availability: anyInStock
              ? "https://schema.org/InStock"
              : "https://schema.org/OutOfStock",
          }
        : undefined,
  }

  const breadcrumbs = [
    { href: `/s/${tenant.slug}`, label: tenant.name },
    ...(detail.product.category_name
      ? [
          {
            href: detail.product.category_slug
              ? `/s/${tenant.slug}?c=${encodeURIComponent(detail.product.category_slug)}`
              : `/s/${tenant.slug}`,
            label: detail.product.category_name,
          },
        ]
      : []),
    { label: detail.product.name },
  ]

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-10">
      <StorefrontBreadcrumbs items={breadcrumbs} />

      <StorefrontProductDetail
        tenantSlug={tenant.slug}
        currency={tenant.currency}
        config={tenant.storefront_config}
        detail={detail}
      />

      <StorefrontRelated
        tenantSlug={tenant.slug}
        products={related}
        currency={tenant.currency}
        hidePrices={tenant.storefront_config.hide_prices}
      />

      {/* JSON-LD for SEO. Inlined with type="application/ld+json" so it's not
          executed; Next strips the script tag from the React tree only when
          using <Script>, but for static JSON-LD the plain script is fine. */}
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: structured data must be raw JSON
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
    </div>
  )
}
