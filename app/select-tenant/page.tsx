import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowRight, Building2, Plus } from "lucide-react"
import { listUserTenants } from "@/lib/tenant/context"
import { createClient } from "@/lib/supabase/server"
import { SignalLogo } from "@/components/brand/signal-logo"
import { Button } from "@/components/ui/button"
import { SignOutButton } from "@/components/auth/sign-out-button"

export const metadata = { title: "Seleccionar espacio" }

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

  if (!user) {
    redirect("/auth/login")
  }

  const tenants = await listUserTenants()

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
            Elegí un espacio
          </h1>
          <p className="mt-2 font-sans text-sm text-muted-foreground">
            Cada espacio es un comercio con sus productos, canales y equipo.
          </p>
        </div>

        {denied ? (
          <div className="mb-6 rounded-lg border border-destructive/20 bg-destructive/5 p-4">
            <p className="font-sans text-sm text-destructive">
              No tenés acceso al espacio <span className="font-mono">{denied}</span>.
            </p>
          </div>
        ) : null}

        {tenants.length === 0 ? (
          <div className="rounded-lg border border-border/60 bg-card p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <h2 className="mt-6 font-display text-2xl font-bold tracking-tight">
              Todavía no tenés ningún espacio
            </h2>
            <p className="mt-2 font-sans text-sm text-muted-foreground">
              Creá tu primer comercio para empezar a sincronizar productos.
            </p>
            <Button asChild className="mt-6 shadow-signal">
              <Link href="/onboarding">
                <Plus className="mr-2 h-4 w-4" />
                Crear mi primer espacio
              </Link>
            </Button>
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
            <Link
              href="/onboarding"
              className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border/60 bg-card/40 p-5 font-sans text-sm text-muted-foreground transition hover:border-primary/40 hover:text-primary"
            >
              <Plus className="h-4 w-4" />
              Crear otro espacio
            </Link>
          </div>
        )}
      </main>
    </div>
  )
}
