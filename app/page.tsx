import Link from "next/link"
import { ArrowRight, Activity, Layers, RefreshCw, ShieldCheck } from "lucide-react"
import { SignalLogo } from "@/components/brand/signal-logo"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"

export default async function LandingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <SignalLogo size="md" />
          <nav className="flex items-center gap-3">
            {user ? (
              <Button asChild>
                <Link href="/select-tenant">
                  Ir al panel
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost">
                  <Link href="/auth/login">Iniciar sesión</Link>
                </Button>
                <Button asChild className="shadow-signal">
                  <Link href="/auth/sign-up">Crear cuenta</Link>
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6">
        <section className="py-20 md:py-28">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-sm border border-primary/20 bg-primary/5 px-3 py-1 font-sans text-xs uppercase tracking-[0.18em] text-primary">
              <Activity className="h-3 w-3" />
              High-Fidelity Signal
            </span>
            <h1 className="mt-6 font-display text-5xl font-extrabold leading-[1.05] tracking-tight text-balance md:text-7xl">
              Un solo hilo entre tu{" "}
              <span className="text-primary">ERP</span> y cada canal de venta.
            </h1>
            <p className="mt-6 max-w-2xl text-pretty font-sans text-lg leading-relaxed text-muted-foreground">
              SignalCore sincroniza productos, variantes, stock y precios entre tu sistema de gestión y
              WooCommerce, Tienda Nube, Mercado Libre, y tu propio storefront — sin perder el control.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Button asChild size="lg" className="shadow-signal">
                <Link href={user ? "/select-tenant" : "/auth/sign-up"}>
                  Empezar ahora
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="#features">Ver cómo funciona</Link>
              </Button>
            </div>
          </div>
        </section>

        <section id="features" className="grid grid-cols-1 gap-4 pb-24 md:grid-cols-3">
          {[
            {
              icon: RefreshCw,
              title: "Sincronización bidireccional",
              body: "Publica productos, actualiza precios y mantiene stock coherente entre ERP y canales.",
              tone: "primary" as const,
            },
            {
              icon: Layers,
              title: "Variantes sin dolor",
              body: "Talles, colores, materiales. Un solo modelo para todos tus canales, con overrides por canal.",
              tone: "tertiary" as const,
            },
            {
              icon: ShieldCheck,
              title: "Multitenant con RLS",
              body: "Aislamiento real por comercio y por usuario. Roles granulares y auditoría completa.",
              tone: "primary" as const,
            },
          ].map(({ icon: Icon, title, body, tone }) => (
            <div
              key={title}
              className={`rounded-lg border border-border/60 bg-card p-6 ${
                tone === "primary" ? "card-accent-primary" : "card-accent-tertiary"
              }`}
            >
              <Icon
                className={`h-5 w-5 ${tone === "primary" ? "text-primary" : "text-tertiary"}`}
              />
              <h3 className="mt-4 font-display text-lg font-bold tracking-tight">{title}</h3>
              <p className="mt-2 font-sans text-sm leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <SignalLogo size="sm" tagline="" />
          <p className="font-sans text-xs text-muted-foreground">
            {"© "}
            {new Date().getFullYear()} SignalCore · v0.1
          </p>
        </div>
      </footer>
    </div>
  )
}
