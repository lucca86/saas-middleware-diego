import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { ArrowDownToLine, AlertTriangle, History, Layers, Package } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { requireTenant } from "@/lib/tenant/context"
import { listStockMovements, listVariantStock, stockSummary } from "@/lib/stock/queries"
import { VariantsStockTable } from "@/components/stock/variants-stock-table"
import { StockMovementsLog } from "@/components/stock/stock-movements-log"

export const metadata: Metadata = {
  title: "Stock",
}

export default async function StockPage({
  params,
}: {
  params: Promise<{ tenant: string }>
}) {
  const { tenant: tenantSlug } = await params
  const ctx = await requireTenant(tenantSlug)
  if (!ctx) notFound()

  const { tenant, role } = ctx
  const canEdit = role === "owner" || role === "admin" || role === "operator"

  const [variants, movements, summary] = await Promise.all([
    listVariantStock(tenant.id),
    listStockMovements(tenant.id, { limit: 200 }),
    stockSummary(tenant.id),
  ])

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Inventario
        </p>
        <h1 className="mt-2 font-display text-3xl font-extrabold leading-tight text-foreground text-balance">
          Stock
        </h1>
        <p className="mt-2 max-w-2xl text-pretty text-sm text-muted-foreground leading-relaxed">
          Cargá entradas, salidas y ajustes desde acá. Cada movimiento queda registrado en un log
          inmutable y el stock de cada variante se mantiene sincronizado automáticamente.
        </p>
      </header>

      <section
        className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5"
        aria-label="Resumen de inventario"
      >
        <KpiCard
          icon={<Package className="h-4 w-4" aria-hidden="true" />}
          label="Unidades activas"
          value={summary.totalUnits.toLocaleString("es-AR")}
        />
        <KpiCard
          icon={<Layers className="h-4 w-4" aria-hidden="true" />}
          label="Variantes"
          value={summary.variantsTracked.toLocaleString("es-AR")}
        />
        <KpiCard
          icon={<AlertTriangle className="h-4 w-4 text-destructive" aria-hidden="true" />}
          label="Sin stock"
          value={summary.outOfStock.toLocaleString("es-AR")}
          tone={summary.outOfStock > 0 ? "warning" : "default"}
        />
        <KpiCard
          icon={<AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden="true" />}
          label="Stock bajo"
          value={summary.lowStock.toLocaleString("es-AR")}
        />
        <KpiCard
          icon={<History className="h-4 w-4" aria-hidden="true" />}
          label="Movimientos · 7d"
          value={summary.movementsLast7Days.toLocaleString("es-AR")}
        />
      </section>

      <Tabs defaultValue="variants" className="flex flex-col gap-4">
        <TabsList className="self-start">
          <TabsTrigger value="variants">
            <Layers className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Variantes
          </TabsTrigger>
          <TabsTrigger value="movements">
            <ArrowDownToLine className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Movimientos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="variants">
          <VariantsStockTable tenantSlug={tenantSlug} variants={variants} canEdit={canEdit} />
        </TabsContent>

        <TabsContent value="movements">
          <StockMovementsLog tenantSlug={tenantSlug} movements={movements} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function KpiCard({
  icon,
  label,
  value,
  tone = "default",
}: {
  icon: React.ReactNode
  label: string
  value: string
  tone?: "default" | "warning"
}) {
  return (
    <div
      className={`rounded-lg border bg-card p-4 ${
        tone === "warning" ? "border-destructive/40" : "border-border"
      }`}
    >
      <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-2 font-display text-2xl font-bold tabular-nums text-foreground">{value}</p>
    </div>
  )
}
