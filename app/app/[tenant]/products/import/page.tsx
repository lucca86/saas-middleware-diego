import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { requireTenant } from "@/lib/tenant/context"
import { ProductsImportClient } from "@/components/products/products-import-client"

export const metadata = { title: "Importar productos" }

export default async function ProductImportPage({
  params,
}: {
  params: Promise<{ tenant: string }>
}) {
  const { tenant: slug } = await params
  await requireTenant(slug)

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link
          href={`/app/${slug}/products`}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          Productos
        </Link>
        <h1 className="mt-2 font-display text-2xl font-bold tracking-tight">Importar productos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Subí un archivo CSV con tu catálogo. Cada fila puede ser un producto o una variante de
          uno existente (agrupamos por nombre).
        </p>
      </div>

      <ProductsImportClient tenantSlug={slug} />
    </div>
  )
}
