import { redirect } from "next/navigation"
import { requireTenant } from "@/lib/tenant/context"
import { listProductTypes } from "@/lib/products/queries"
import { ProductForm } from "@/components/products/product-form"

export const metadata = {
  title: "Nuevo producto",
}

export default async function NewProductPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params
  const { tenant, role } = await requireTenant(slug)
  if (role === "viewer") redirect(`/app/${slug}/products`)

  const types = await listProductTypes(tenant.id)

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">Catálogo</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold leading-tight text-foreground">Nuevo producto</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Elegí un tipo para que generemos automáticamente la grilla de variantes.
        </p>
      </header>

      <ProductForm tenantSlug={slug} types={types} mode="create" currency={tenant.currency} />
    </div>
  )
}
