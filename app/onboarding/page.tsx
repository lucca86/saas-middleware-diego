import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
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

  const { data: memberships } = await supabase
    .from("tenant_members")
    .select("tenant_id")
    .eq("user_id", user.id)
    .limit(1)

  if (memberships && memberships.length > 0) {
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
