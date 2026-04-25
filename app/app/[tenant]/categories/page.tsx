import { requireTenant } from "@/lib/tenant/context"
import { listCategories } from "@/lib/products/queries"
import { CategoriesManager } from "@/components/categories/categories-manager"

export const metadata = {
  title: "Categorías",
}

export default async function CategoriesPage({
  params,
}: {
  params: Promise<{ tenant: string }>
}) {
  const { tenant: slug } = await params
  const { tenant, role } = await requireTenant(slug)
  const categories = await listCategories(tenant.id)

  const canEdit = role === "owner" || role === "admin" || role === "operator"

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-8 flex flex-col gap-2">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Catálogo · Configuración
        </p>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-extrabold leading-tight text-foreground text-balance">
              Categorías
            </h1>
            <p className="mt-2 max-w-2xl text-pretty text-sm text-muted-foreground leading-relaxed">
              Organizá tus productos en categorías. Cada producto pertenece a una sola categoría.
            </p>
          </div>
        </div>
      </header>

      <CategoriesManager tenantSlug={slug} categories={categories} canEdit={canEdit} />
    </div>
  )
}
