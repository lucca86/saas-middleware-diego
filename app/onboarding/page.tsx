import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { SignalLogo } from "@/components/brand/signal-logo"
import { OnboardingForm } from "@/components/onboarding/onboarding-form"
import { SignOutButton } from "@/components/auth/sign-out-button"

export const metadata = { title: "Crear espacio" }

export default async function OnboardingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
          <SignalLogo size="md" />
          <SignOutButton />
        </div>
      </header>

      <main className="mx-auto max-w-xl px-6 py-16">
        <div className="mb-10">
          <span className="inline-flex items-center gap-2 rounded-sm border border-primary/20 bg-primary/5 px-3 py-1 font-sans text-xs uppercase tracking-[0.18em] text-primary">
            Paso 1 de 1
          </span>
          <h1 className="mt-6 font-display text-4xl font-extrabold tracking-tight">
            Creá tu espacio
          </h1>
          <p className="mt-2 font-sans text-sm text-muted-foreground">
            Esto va a ser el contenedor de tus productos, canales y equipo. Podés crear varios
            después si manejás más de un comercio.
          </p>
        </div>

        <div className="rounded-lg border border-border/60 bg-card p-6 shadow-signal">
          <OnboardingForm />
        </div>
      </main>
    </div>
  )
}
