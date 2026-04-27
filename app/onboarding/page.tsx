import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { isPlatformAdmin } from "@/lib/platform/auth"
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard"
import { SignalLogo } from "@/components/brand/signal-logo"
import { SignOutButton } from "@/components/auth/sign-out-button"

export const metadata = { title: "Crear espacio" }

export default async function OnboardingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/auth/login")

  // Self-service tenant creation is disabled. Only platform admins can
  // create tenants, and they do so from /admin/tenants. Anybody else who
  // ends up here is bounced back to the dispatcher.
  const platformAdmin = await isPlatformAdmin()
  if (!platformAdmin) {
    redirect("/select-tenant")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle()

  const defaultName =
    profile?.full_name ??
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    ""

  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
          <SignalLogo size="md" />
          <SignOutButton />
        </div>
      </header>
      <main className="mx-auto w-full max-w-xl px-6 py-12">
        <div className="rounded-lg border border-border/60 bg-card p-8 shadow-signal-soft">
          <OnboardingWizard defaultFullName={defaultName} />
        </div>
      </main>
    </div>
  )
}
