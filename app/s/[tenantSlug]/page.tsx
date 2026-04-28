import { notFound } from "next/navigation"
import type { Metadata } from "next"
import {
  getPublicTenant,
  listFeaturedProducts,
  listPublicCategories,
  listPublicProducts,
  type PublicSort,
} from "@/lib/storefront/queries"
import { StorefrontHero } from "@/components/storefront/public/storefront-hero"
import { StorefrontCategoryFilter } from "@/components/storefront/public/storefront-category-filter"
import { StorefrontProductGrid } from "@/components/storefront/public/storefront-product-grid"
import { StorefrontAbout } from "@/components/storefront/public/storefront-about"
import { StorefrontSearchBar } from "@/components/storefront/public/storefront-search-bar"
import { StorefrontFeatured } from "@/components/storefront/public/storefront-featured"

const VALID_SORTS: PublicSort[] = ["newest", "price-asc", "price-desc", "name"]

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
  searchParams: Promise<{ c?: string; q?: string; sort?: string; stock?: string }>
}) {
  const { tenantSlug } = await params
  const sp = await searchParams
  const tenant = await getPublicTenant(tenantSlug)
  if (!tenant) notFound()

  const sort = (VALID_SORTS as string[]).includes(sp.sort ?? "")
    ? (sp.sort as PublicSort)
    : "newest"
  const inStock = sp.stock === "1"
  const hasActiveFilters = Boolean(sp.q || sp.c || sp.stock || (sp.sort && sp.sort !== "newest"))

  const [products, categories, featured] = await Promise.all([
    listPublicProducts(
      tenant.id,
      { categorySlug: sp.c, search: sp.q, sort, inStock },
      { hideOutOfStock: tenant.storefront_config.hide_out_of_stock },
    ),
    listPublicCategories(tenant.id),
    // Only show the featured shelf on the truly empty state — no filters,
    // no search, no category, default sort. Otherwise it duplicates the grid.
    hasActiveFilters
      ? Promise.resolve([])
      : listFeaturedProducts(tenant.id),
  ])

  return (
    <>
      <StorefrontHero tenant={tenant} />

      {featured.length > 0 ? (
        <StorefrontFeatured
          tenantSlug={tenant.slug}
          products={featured}
          currency={tenant.currency}
          hidePrices={tenant.storefront_config.hide_prices}
        />
      ) : null}

      <section className="mx-auto max-w-6xl px-4 pb-12 md:px-6">
        <StorefrontSearchBar
          tenantSlug={tenant.slug}
          initialQuery={sp.q ?? ""}
          initialSort={sort}
          initialInStock={inStock}
        />

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
          hasActiveFilters={hasActiveFilters}
        />
      </section>

      <StorefrontAbout config={tenant.storefront_config} />
    </>
  )
}
