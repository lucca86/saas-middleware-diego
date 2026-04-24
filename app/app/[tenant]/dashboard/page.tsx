import { Activity, ShoppingCart, Store, Zap } from "lucide-react"
import { requireTenant } from "@/lib/tenant/context"

export const metadata = { title: "Dashboard" }

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ tenant: string }>
}) {
  const { tenant: slug } = await params
  const tenant = await requireTenant(slug)

  return (
    <div className="mx-auto max-w-7xl px-8 py-10">
      <div className="mb-10">
        <div className="flex items-center gap-2 font-sans text-xs uppercase tracking-[0.18em] text-primary">
          <Activity className="h-3 w-3" />
          System Pulse · Stable
        </div>
        <h1 className="mt-3 font-display text-5xl font-extrabold leading-[1.05] tracking-tight text-balance">
          Connectivity Overview
        </h1>
        <p className="mt-3 max-w-2xl font-sans text-sm leading-relaxed text-muted-foreground">
          {`Monitoreo de sincronización global entre tus canales y el ERP de ${tenant.name}.`}
        </p>
      </div>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-4">
        <StatusCard icon={Activity} label="Health Score" value="98.4%" hint="+0.2% desde último ciclo" tone="primary" />
        <StatusCard icon={ShoppingCart} label="WooCommerce" value="Active" hint="Last sync · nunca" tone="primary" />
        <StatusCard icon={Store} label="Storefront" value="Ready" hint="Publicá tu catálogo" tone="tertiary" />
        <StatusCard icon={Zap} label="Throughput" value="0 ops/s" hint="Esperando primer sync" tone="tertiary" />
      </section>

      <section className="mt-10 rounded-lg border border-border/60 bg-card p-8">
        <h2 className="font-display text-2xl font-extrabold tracking-tight">
          Bienvenido a {tenant.name}
        </h2>
        <p className="mt-2 max-w-2xl font-sans text-sm leading-relaxed text-muted-foreground">
          Tu espacio está listo. En los próximos sprints vas a poder cargar productos con variantes,
          publicar tu storefront, conectar WooCommerce y ver el motor de sync en vivo. Por ahora,
          este dashboard es una cabecera técnica que vamos a llenar con señales reales.
        </p>
        <div className="mt-6 flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 px-4 py-3">
          <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-signal" aria-hidden="true" />
          <span className="font-sans text-xs uppercase tracking-[0.14em] text-primary">
            Sprint 1 · Fundación completada
          </span>
        </div>
      </section>
    </div>
  )
}

function StatusCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  hint: string
  tone: "primary" | "tertiary"
}) {
  return (
    <div
      className={`rounded-lg border border-border/60 bg-card p-5 ${
        tone === "primary" ? "card-accent-primary" : "card-accent-tertiary"
      }`}
    >
      <div className="flex items-center justify-between">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-md ${
            tone === "primary" ? "bg-primary/10 text-primary" : "bg-tertiary/10 text-tertiary"
          }`}
        >
          <Icon className="h-4 w-4" />
        </div>
        <span
          className={`rounded-sm border px-2 py-0.5 font-sans text-[10px] uppercase tracking-[0.14em] ${
            tone === "primary"
              ? "border-primary/20 bg-primary/5 text-primary"
              : "border-tertiary/20 bg-tertiary/5 text-tertiary"
          }`}
        >
          {label}
        </span>
      </div>
      <p className="mt-6 font-display text-4xl font-extrabold tracking-tight text-foreground">
        {value}
      </p>
      <p className="mt-1 font-sans text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}
