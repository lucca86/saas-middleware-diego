import { notFound } from "next/navigation"
import Link from "next/link"
import type { Metadata } from "next"
import { ChevronLeft } from "lucide-react"
import {
  getPublicProductBySlug,
  getPublicTenant,
} from "@/lib/storefront/queries"
import { StorefrontProductDetail } from "@/components/storefront/public/storefront-product-detail"

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

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-10">
      <Link
        href={`/s/${tenant.slug}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Volver al catálogo
      </Link>

      <StorefrontProductDetail
        tenantSlug={tenant.slug}
        currency={tenant.currency}
        config={tenant.storefront_config}
        detail={detail}
      />
    </div>
  )
}
