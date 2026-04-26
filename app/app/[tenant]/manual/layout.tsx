import { ManualShell } from "@/components/manual/manual-shell"
import { buildSearchIndex } from "@/lib/manual/articles"

export const metadata = {
  title: "Manual",
}

export default async function ManualLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ tenant: string }>
}) {
  const { tenant } = await params
  const index = buildSearchIndex()

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-1">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Ayuda
        </p>
        <h1 className="font-display text-3xl font-extrabold leading-tight text-foreground text-balance">
          Manual del sistema
        </h1>
        <p className="max-w-2xl text-pretty text-sm text-muted-foreground leading-relaxed">
          Cómo está pensada la app, qué significa cada término y cómo se hacen
          las cosas. Buscá por palabra clave o navegá por sección.
        </p>
      </header>

      <ManualShell tenantSlug={tenant} index={index}>
        {children}
      </ManualShell>
    </div>
  )
}
