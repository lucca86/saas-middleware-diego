import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowRight, Building2, ShieldCheck } from "lucide-react"
import { listUserTenants } from "@/lib/tenant/context"
import { isPlatformAdmin } from "@/lib/platform/auth"
import { createClient } from "@/lib/supabase/server"
import { SignalLogo } from "@/components/brand/signal-logo"
import { SignOutButton } from "@/components/auth/sign-out-button"

export const metadata = { title: "Seleccionar espacio" }

/**
 * Post-login dispatcher.
 *
 * Routing rules:
 *  - Platform admins → `/admin` (the global control panel).
 *  - Users with exactly 1 tenant → `/app/<slug>/dashboard` (skip the picker).
 *  - Users with 2+ tenants → render the picker below.
 *  - Users with 0 tenants → show "waiting for assignment" state. There's no
 *    self-service tenant creation: only platform admins can create tenants
 *    from `/admin/tenants`.
 */
export default async function SelectTenantPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>
}) {
  const { denied } = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const [tenants, platformAdmin] = await Promise.all([listUserTenants(), isPlatformAdmin()])

  // Platform admins get sent to the admin panel by default. They can still
  // jump into a specific tenant from /admin/tenants.
  if (platformAdmin && !denied) {
    redirect("/admin")
  }

  // Single-tenant users skip the picker entirely.
  if (tenants.length === 1 && !denied) {
    redirect(`/app/${tenants[0].slug}/dashboard`)
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <SignalLogo size="md" />
          <SignOutButton />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-16">
        <div className="mb-10">
          <h1 className="font-display text-4xl font-extrabold tracking-tight">
            {tenants.length === 0 ? "Tu cuenta está lista" : "Elegí un espacio"}
          </h1>
          <p className="mt-2 font-sans text-sm text-muted-foreground">
            {tenants.length === 0
              ? "Esperá a que un administrador te asigne a un espacio para empezar."
              : "Cada espacio es un comercio con sus productos, canales y equipo."}
          </p>
        </div>

        {denied ? (
          <div className="mb-6 rounded-lg border border-destructive/20 bg-destructive/5 p-4">
            <p className="font-sans text-sm text-destructive">
              No tenés acceso a ese espacio. Elegí uno de los disponibles para tu cuenta.
            </p>
          </div>
        ) : null}

        {tenants.length === 0 ? (
          <div className="rounded-lg border border-border/60 bg-card p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <h2 className="mt-6 font-display text-2xl font-bold tracking-tight">
              Sin espacios asignados
            </h2>
            <p className="mx-auto mt-2 max-w-md font-sans text-sm text-muted-foreground">
              Solo los administradores de la plataforma pueden crear espacios y asignarte. Si esperás
              acceso a un comercio, pedile al admin que te invite desde su panel.
            </p>
            <p className="mx-auto mt-4 max-w-md font-sans text-xs text-muted-foreground">
              Tu cuenta:{" "}
              <span className="font-mono text-foreground">{user.email}</span>
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {tenants.map((t) => (
              <Link
                key={t.id}
                href={`/app/${t.slug}/dashboard`}
                className="group flex items-center justify-between rounded-lg border border-border/60 bg-card p-5 transition hover:border-primary/40 hover:shadow-signal"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 font-display text-sm font-extrabold text-primary">
                    {t.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-display text-base font-bold tracking-tight">{t.name}</p>
                    <p className="font-sans text-xs text-muted-foreground">
                      {t.role} · {t.plan}
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
              </Link>
            ))}
            {platformAdmin ? (
              <Link
                href="/admin"
                className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-primary/30 bg-primary/5 p-5 font-sans text-sm text-primary transition hover:border-primary/60"
              >
                <ShieldCheck className="h-4 w-4" />
                Panel de plataforma
              </Link>
            ) : null}
          </div>
        )}
      </main>
    </div>
  )
}
