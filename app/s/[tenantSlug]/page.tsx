import { notFound } from "next/navigation"
import type { Metadata } from "next"
import {
  getPublicTenant,
  listPublicCategories,
  listPublicProducts,
} from "@/lib/storefront/queries"
import { StorefrontHero } from "@/components/storefront/public/storefront-hero"
import { StorefrontCategoryFilter } from "@/components/storefront/public/storefront-category-filter"
import { StorefrontProductGrid } from "@/components/storefront/public/storefront-product-grid"
import { StorefrontAbout } from "@/components/storefront/public/storefront-about"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenantSlug: string }>
}): Promise<Metadata> {
  const { tenantSlug } = await params
  const tenant = await getPublicTenant(tenantSlug)
  if (!tenant) {
    return { title: "Tienda no disponible" }
  }
  const config = tenant.storefront_config
  const title = config.hero_title || tenant.name
  const description =
    config.hero_subtitle ||
    config.about?.slice(0, 160) ||
    `Conocé el catálogo de ${tenant.name}.`
  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
  }
}

export default async function StorefrontHomePage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>
  searchParams: Promise<{ c?: string; q?: string }>
}) {
  const { tenantSlug } = await params
  const sp = await searchParams
  const tenant = await getPublicTenant(tenantSlug)
  if (!tenant) notFound()

  const [products, categories] = await Promise.all([
    listPublicProducts(
      tenant.id,
      { categorySlug: sp.c, search: sp.q },
      { hideOutOfStock: tenant.storefront_config.hide_out_of_stock },
    ),
    listPublicCategories(tenant.id),
  ])

  return (
    <>
      <StorefrontHero tenant={tenant} />

      <section className="mx-auto max-w-6xl px-4 pb-12 md:px-6">
        {categories.length > 0 ? (
          <StorefrontCategoryFilter
            tenantSlug={tenant.slug}
            categories={categories}
            active={sp.c}
            totalCount={products.length}
          />
        ) : null}

        <StorefrontProductGrid
          tenantSlug={tenant.slug}
          products={products}
          currency={tenant.currency}
          hidePrices={tenant.storefront_config.hide_prices}
        />
      </section>

      <StorefrontAbout config={tenant.storefront_config} />
    </>
  )
}
