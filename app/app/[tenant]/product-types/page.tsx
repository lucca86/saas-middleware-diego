import { requireTenant } from "@/lib/tenant/context"
import { listProductTypes } from "@/lib/products/queries"
import { ProductTypesGrid } from "@/components/products/product-types-grid"

export const metadata = {
  title: "Tipos de producto",
}

export default async function ProductTypesPage({
  params,
}: {
  params: Promise<{ tenant: string }>
}) {
  const { tenant: slug } = await params
  const { tenant, role } = await requireTenant(slug)
  const types = await listProductTypes(tenant.id)

  const canEdit = role === "owner" || role === "admin" || role === "operator"

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-8 flex flex-col gap-2">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Catálogo · Configuración
        </p>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-extrabold leading-tight text-foreground text-balance">
              Tipos de producto
            </h1>
            <p className="mt-2 max-w-2xl text-pretty text-sm text-muted-foreground leading-relaxed">
              Definí qué atributos tiene cada tipo de producto y cuáles generan variantes. Indumentaria, calzado o
              cualquier categoría que necesites.
            </p>
          </div>
        </div>
      </header>

      <ProductTypesGrid tenantSlug={slug} types={types} canEdit={canEdit} />
    </div>
  )
}
