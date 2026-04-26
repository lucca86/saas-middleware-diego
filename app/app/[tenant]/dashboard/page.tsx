import Link from "next/link"
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  ExternalLink,
  Globe,
  Package,
  Settings2,
  TrendingUp,
} from "lucide-react"
import { requireTenant } from "@/lib/tenant/context"
import {
  getDashboardSummary,
  getLowStockVariants,
  getRecentMovements,
} from "@/lib/dashboard/queries"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty"

export const metadata = { title: "Dashboard" }

const ARS = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
})
const NUM = new Intl.NumberFormat("es-AR")

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ tenant: string }>
}) {
  const { tenant: slug } = await params
  const { tenant } = await requireTenant(slug)

  const [summary, lowStock, movements] = await Promise.all([
    getDashboardSummary(tenant.id),
    getLowStockVariants(tenant.id, 10),
    getRecentMovements(tenant.id, 10),
  ])

  const base = `/app/${slug}`

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-sans text-xs uppercase tracking-[0.18em] text-primary">
            <TrendingUp className="h-3 w-3" />
            Panel principal
          </div>
          <h1 className="mt-3 font-display text-3xl font-extrabold leading-tight tracking-tight">
            {tenant.name}
          </h1>
          <p className="mt-1 font-sans text-sm text-muted-foreground">
            Estado del catálogo, stock y storefront en tiempo real.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`${base}/products/new`}>
              <Package className="mr-1.5 h-4 w-4" />
              Nuevo producto
            </Link>
          </Button>
          {summary.storefrontPublished ? (
            <Button asChild size="sm">
              <Link href={`/s/${slug}`} target="_blank" rel="noopener noreferrer">
                <Globe className="mr-1.5 h-4 w-4" />
                Ver storefront
                <ExternalLink className="ml-1.5 h-3 w-3" />
              </Link>
            </Button>
          ) : (
            <Button asChild size="sm">
              <Link href={`${base}/storefront`}>
                <Globe className="mr-1.5 h-4 w-4" />
                Publicar storefront
              </Link>
            </Button>
          )}
        </div>
      </header>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi
          label="Productos activos"
          value={NUM.format(summary.productsActive)}
          hint={
            summary.productsDraft > 0
              ? `${summary.productsDraft} en borrador`
              : "Listos para vender"
          }
          icon={Package}
          accent="primary"
        />
        <Kpi
          label="Unidades en stock"
          value={NUM.format(summary.unitsOnHand)}
          hint={`${NUM.format(summary.variantsTotal)} variantes activas`}
          icon={Boxes}
          accent="primary"
        />
        <Kpi
          label="Valor de inventario"
          value={summary.inventoryValue > 0 ? ARS.format(summary.inventoryValue) : "—"}
          hint="Calculado al costo cargado"
          icon={TrendingUp}
          accent="tertiary"
        />
        <Kpi
          label="Movimientos (7d)"
          value={NUM.format(summary.movements7d)}
          hint="Auditados y trazables"
          icon={Settings2}
          accent="tertiary"
        />
      </section>

      {summary.outOfStockCount + summary.lowStockCount > 0 ? (
        <section className="rounded-lg border border-warning/30 bg-warning/5 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden />
            <div className="flex-1">
              <h2 className="font-display text-base font-semibold">Atención</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {summary.outOfStockCount > 0 ? (
                  <>
                    <strong className="text-foreground">{summary.outOfStockCount}</strong> variante
                    {summary.outOfStockCount === 1 ? "" : "s"} sin stock.{" "}
                  </>
                ) : null}
                {summary.lowStockCount > 0 ? (
                  <>
                    <strong className="text-foreground">{summary.lowStockCount}</strong> con stock
                    bajo (≤ 5 unidades).
                  </>
                ) : null}
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href={`${base}/stock`}>Ver detalle</Link>
            </Button>
          </div>
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-display text-base font-semibold">Stock bajo</h2>
                <p className="text-xs text-muted-foreground">
                  Variantes con 5 unidades o menos.
                </p>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link href={`${base}/stock`}>Ver todo</Link>
              </Button>
            </div>
            {lowStock.length === 0 ? (
              <Empty className="border-none">
                <EmptyMedia>
                  <Boxes className="h-8 w-8 text-muted-foreground" />
                </EmptyMedia>
                <EmptyTitle>Todo bajo control</EmptyTitle>
                <EmptyDescription>Ninguna variante necesita reposición.</EmptyDescription>
              </Empty>
            ) : (
              <ul className="divide-y divide-border">
                {lowStock.map((row) => {
                  const attrs = Object.values(row.attributes).filter(Boolean).join(" · ")
                  const isOut = row.stock <= 0
                  return (
                    <li key={row.variant_id} className="flex items-center gap-3 py-2.5">
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                        {row.primary_image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={row.primary_image_url}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`${base}/products/${row.product_id}`}
                          className="block truncate text-sm font-medium hover:underline"
                        >
                          {row.product_name}
                        </Link>
                        <div className="truncate text-xs text-muted-foreground">
                          {attrs || "Sin variante"}
                        </div>
                      </div>
                      <Badge
                        className={
                          isOut
                            ? "border-destructive/40 bg-destructive/15 text-destructive"
                            : "border-warning/40 bg-warning/15 text-warning"
                        }
                      >
                        {isOut ? "Sin stock" : `${row.stock} u.`}
                      </Badge>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-display text-base font-semibold">Movimientos recientes</h2>
                <p className="text-xs text-muted-foreground">
                  Últimos cambios de stock auditados.
                </p>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link href={`${base}/stock`}>Ver todo</Link>
              </Button>
            </div>
            {movements.length === 0 ? (
              <Empty className="border-none">
                <EmptyMedia>
                  <Settings2 className="h-8 w-8 text-muted-foreground" />
                </EmptyMedia>
                <EmptyTitle>Sin movimientos aún</EmptyTitle>
                <EmptyDescription>
                  Cuando registres entradas o salidas de stock van a aparecer acá.
                </EmptyDescription>
              </Empty>
            ) : (
              <ul className="divide-y divide-border">
                {movements.map((m) => {
                  const attrs = Object.values(m.attributes).filter(Boolean).join(" · ")
                  const positive = m.qty >= 0
                  return (
                    <li key={m.id} className="flex items-center gap-3 py-2.5">
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
                          positive
                            ? "bg-success/10 text-success"
                            : "bg-destructive/10 text-destructive"
                        }`}
                      >
                        {positive ? (
                          <ArrowDownToLine className="h-4 w-4" />
                        ) : (
                          <ArrowUpFromLine className="h-4 w-4" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm">
                          <span className="font-medium">{m.product_name}</span>
                          {attrs ? (
                            <span className="text-muted-foreground"> · {attrs}</span>
                          ) : null}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {m.reason ?? labelForType(m.type)} ·{" "}
                          {new Date(m.created_at).toLocaleString("es-AR", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </div>
                      </div>
                      <span
                        className={`tabular-nums font-semibold ${
                          positive ? "text-success" : "text-destructive"
                        }`}
                      >
                        {positive ? "+" : ""}
                        {m.qty}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function labelForType(type: "initial" | "in" | "out" | "adjustment") {
  switch (type) {
    case "initial":
      return "Stock inicial"
    case "in":
      return "Entrada"
    case "out":
      return "Salida"
    case "adjustment":
      return "Ajuste"
  }
}

function Kpi({
  label,
  value,
  hint,
  icon: Icon,
  accent,
}: {
  label: string
  value: string
  hint: string
  icon: React.ComponentType<{ className?: string }>
  accent: "primary" | "tertiary"
}) {
  return (
    <Card className={accent === "primary" ? "card-accent-primary" : "card-accent-tertiary"}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <span
            className={`flex h-9 w-9 items-center justify-center rounded-md ${
              accent === "primary" ? "bg-primary/10 text-primary" : "bg-tertiary/10 text-tertiary"
            }`}
          >
            <Icon className="h-4 w-4" />
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {label}
          </span>
        </div>
        <div className="mt-4 font-display text-3xl font-extrabold tabular-nums tracking-tight">
          {value}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
      </CardContent>
    </Card>
  )
}
