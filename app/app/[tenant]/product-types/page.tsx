import Link from "next/link"
import { Ruler } from "lucide-react"
import { requireTenant } from "@/lib/tenant/context"
import { listProductTypes, listSizeCurves } from "@/lib/products/queries"
import { Button } from "@/components/ui/button"
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
  const [types, curves] = await Promise.all([listProductTypes(tenant.id), listSizeCurves(tenant.id)])

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
              Definí qué atributos tiene cada tipo de producto y cuáles generan variantes. Conectá atributos a
              curvas de talles reutilizables para no escribir las opciones a mano.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href={`/app/${slug}/size-curves`}>
              <Ruler className="mr-1.5 h-4 w-4" />
              Curvas de talles
            </Link>
          </Button>
        </div>
      </header>

      <ProductTypesGrid tenantSlug={slug} types={types} curves={curves} canEdit={canEdit} />
    </div>
  )
}
