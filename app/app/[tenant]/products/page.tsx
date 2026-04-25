import Link from "next/link"
import { Plus, Settings2 } from "lucide-react"
import { requireTenant } from "@/lib/tenant/context"
import { listProducts, listProductTypes, productCounts } from "@/lib/products/queries"
import { Button } from "@/components/ui/button"
import { ProductsTable } from "@/components/products/products-table"
import { ProductsFilters } from "@/components/products/products-filters"

export const metadata = {
  title: "Productos",
}

interface PageProps {
  params: Promise<{ tenant: string }>
  searchParams: Promise<{ q?: string; status?: string; type?: string }>
}

export default async function ProductsPage({ params, searchParams }: PageProps) {
  const { tenant: slug } = await params
  const sp = await searchParams
  const { tenant, role } = await requireTenant(slug)

  const [items, types, counts] = await Promise.all([
    listProducts(tenant.id, {
      search: sp.q,
      status: (sp.status as never) ?? "all",
      typeId: sp.type,
    }),
    listProductTypes(tenant.id),
    productCounts(tenant.id),
  ])

  const canEdit = role === "owner" || role === "admin" || role === "operator"

  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-6 flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">Catálogo</p>
            <h1 className="mt-1 font-display text-3xl font-extrabold leading-tight text-foreground">Productos</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {counts.total} en total · {counts.active} activos · {counts.draft} en borrador
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/app/${slug}/product-types`}>
                <Settings2 className="mr-1.5 h-4 w-4" />
                Tipos
              </Link>
            </Button>
            {canEdit ? (
              <Button asChild size="sm" className="shadow-signal">
                <Link href={`/app/${slug}/products/new`}>
                  <Plus className="mr-1.5 h-4 w-4" />
                  Nuevo producto
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      </header>

      <ProductsFilters
        types={types.map((t) => ({ id: t.id, name: t.name }))}
        defaultValues={{
          q: sp.q ?? "",
          status: (sp.status as never) ?? "all",
          typeId: sp.type ?? "all",
        }}
      />

      <div className="mt-6">
        <ProductsTable tenantSlug={slug} items={items} />
      </div>
    </div>
  )
}
