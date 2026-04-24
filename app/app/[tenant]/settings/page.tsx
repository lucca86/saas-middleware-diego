import { requireTenant } from "@/lib/tenant/context"

export const metadata = { title: "Configuración" }

export default async function GeneralSettingsPage({
  params,
}: {
  params: Promise<{ tenant: string }>
}) {
  const { tenant: slug } = await params
  const { tenant, role } = await requireTenant(slug)

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-extrabold tracking-tight text-foreground">
            Información general
          </h2>
          <p className="text-sm text-muted-foreground">
            Datos básicos de tu espacio de trabajo.
          </p>
        </div>
        <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Tu rol: <span className="text-primary">{role}</span>
        </span>
      </header>

      <dl className="grid gap-0 overflow-hidden rounded-md border border-border/60 divide-y divide-border/60">
        <Row label="Nombre" value={tenant.name} />
        <Row label="Identificador" value={tenant.slug} mono />
        <Row label="Tipo de negocio" value={tenant.business_type ?? "—"} />
        <Row label="Moneda" value={tenant.currency} mono />
        <Row label="Zona horaria" value={tenant.timezone} mono />
        <Row label="Plan" value={tenant.plan} />
      </dl>

      <p className="text-xs text-muted-foreground">
        La edición inline de estos datos se habilita en el Sprint siguiente.
      </p>
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 bg-card px-4 py-3">
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd
        className={
          mono
            ? "font-mono text-sm font-semibold text-foreground"
            : "text-sm font-semibold text-foreground"
        }
      >
        {value}
      </dd>
    </div>
  )
}
