import { notFound } from "next/navigation"
import { requireTenant } from "@/lib/tenant/context"
import { getProduct, listProductTypes } from "@/lib/products/queries"
import { ProductForm } from "@/components/products/product-form"

export const metadata = {
  title: "Editar producto",
}

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ tenant: string; id: string }>
}) {
  const { tenant: slug, id } = await params
  const { tenant, role } = await requireTenant(slug)

  const [data, types] = await Promise.all([getProduct(tenant.id, id), listProductTypes(tenant.id)])
  if (!data) notFound()

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">Catálogo</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold leading-tight text-foreground">{data.product.name}</h1>
        <p className="mt-1 font-mono text-xs text-muted-foreground">{data.product.sku ?? data.product.slug}</p>
      </header>

      <ProductForm
        tenantSlug={slug}
        types={types}
        mode="edit"
        currency={tenant.currency}
        readonly={role === "viewer"}
        initial={{ product: data.product, variants: data.variants }}
      />
    </div>
  )
}
