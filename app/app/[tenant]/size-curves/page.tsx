import { requireTenant } from "@/lib/tenant/context"
import { listSizeCurves } from "@/lib/products/queries"
import { SizeCurvesManager } from "@/components/size-curves/size-curves-manager"

export const metadata = {
  title: "Listas de opciones",
}

export default async function SizeCurvesPage({
  params,
}: {
  params: Promise<{ tenant: string }>
}) {
  const { tenant: slug } = await params
  const { tenant, role } = await requireTenant(slug)
  const curves = await listSizeCurves(tenant.id)

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
              Listas de opciones
            </h1>
            <p className="mt-2 max-w-2xl text-pretty text-sm text-muted-foreground leading-relaxed">
              Definí listas reutilizables de talles, colores y materiales (ej: &ldquo;1 a 5 años&rdquo;,
              &ldquo;Básicos&rdquo;, &ldquo;Algodón orgánico&rdquo;). Cada lista se enchufa a un atributo de
              tipo de producto y se puede sobreescribir por producto.
            </p>
          </div>
        </div>
      </header>

      <SizeCurvesManager tenantSlug={slug} curves={curves} canEdit={canEdit} />
    </div>
  )
}
