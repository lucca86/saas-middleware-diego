import Link from "next/link"
import { AlertCircle, CheckCircle2, Mail } from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { SignalLogo } from "@/components/brand/signal-logo"
import { Button } from "@/components/ui/button"
import { AcceptInvitationButton } from "@/components/members/accept-invitation-button"

export const metadata = { title: "Invitación" }

export default async function InvitationPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const next = `/invitations/${token}`
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: invitation } = await supabase
    .from("tenant_invitations")
    .select(
      `
      id, email, role, expires_at, accepted_at,
      tenants:tenants!inner ( id, slug, name )
    `,
    )
    .eq("token", token)
    .maybeSingle()

  const tenant = (() => {
    if (!invitation) return null
    const t = invitation.tenants
    return Array.isArray(t) ? t[0] : t
  })()

  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <header className="border-b border-border/60 px-6 py-4">
        <SignalLogo size="md" />
      </header>

      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-md rounded-lg border border-border/60 bg-card p-8 shadow-signal-soft">
          {!invitation ? (
            <InvalidState
              icon={AlertCircle}
              title="Invitación no encontrada"
              description="El link es inválido o ya fue utilizado. Pedile a un administrador que genere uno nuevo."
            />
          ) : invitation.accepted_at ? (
            <InvalidState
              icon={CheckCircle2}
              title="Invitación ya aceptada"
              description="Esta invitación ya fue utilizada. Si creés que es un error, contactá a un administrador."
            />
          ) : new Date(invitation.expires_at).getTime() < Date.now() ? (
            <InvalidState
              icon={AlertCircle}
              title="Invitación expirada"
              description="Este link ya expiró. Pedile a un administrador que genere uno nuevo."
            />
          ) : !user ? (
            <GuestState
              email={invitation.email}
              tenantName={tenant?.name ?? "un espacio"}
              next={next}
            />
          ) : user.email?.toLowerCase() !== invitation.email.toLowerCase() ? (
            <div className="flex flex-col gap-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div>
                <h1 className="font-display text-2xl font-extrabold tracking-tight">
                  Email no coincide
                </h1>
                <p className="mt-2 font-sans text-sm text-muted-foreground">
                  Esta invitación fue enviada a{" "}
                  <span className="font-mono text-foreground">{invitation.email}</span> pero
                  iniciaste sesión como{" "}
                  <span className="font-mono text-foreground">{user.email}</span>.
                </p>
              </div>
              <form action="/auth/sign-out" method="post">
                <Button variant="outline" type="submit" className="w-full">
                  Cerrar sesión y probar con otra cuenta
                </Button>
              </form>
            </div>
          ) : (
            <div className="flex flex-col gap-6 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary shadow-signal">
                <Mail className="h-6 w-6" />
              </div>
              <div>
                <h1 className="font-display text-3xl font-extrabold tracking-tight">
                  Te invitaron a{" "}
                  <span className="text-primary">{tenant?.name ?? "un espacio"}</span>
                </h1>
                <p className="mt-2 font-sans text-sm text-muted-foreground">
                  Vas a unirte con el rol{" "}
                  <span className="font-mono uppercase text-foreground">{invitation.role}</span>.
                </p>
              </div>
              <AcceptInvitationButton token={token} />
              <Link
                href="/select-tenant"
                className="font-sans text-xs text-muted-foreground hover:text-foreground"
              >
                Rechazar y volver
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

function GuestState({
  email,
  tenantName,
  next,
}: {
  email: string
  tenantName: string
  next: string
}) {
  return (
    <div className="flex flex-col gap-6 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary shadow-signal">
        <Mail className="h-6 w-6" />
      </div>
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">
          Te invitaron a <span className="text-primary">{tenantName}</span>
        </h1>
        <p className="mt-2 font-sans text-sm text-muted-foreground">
          Para aceptar, ingresá o creá tu cuenta con{" "}
          <span className="font-mono text-foreground">{email}</span>.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Button asChild className="w-full">
          <Link href={`/auth/sign-up?next=${encodeURIComponent(next)}&email=${encodeURIComponent(email)}`}>
            Crear cuenta
          </Link>
        </Button>
        <Button asChild variant="outline" className="w-full">
          <Link href={`/auth/login?next=${encodeURIComponent(next)}`}>
            Ya tengo cuenta
          </Link>
        </Button>
      </div>
    </div>
  )
}

function InvalidState({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof AlertCircle
  title: string
  description: string
}) {
  return (
    <div className="flex flex-col gap-4 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight">{title}</h1>
        <p className="mt-2 font-sans text-sm text-muted-foreground">{description}</p>
      </div>
      <Button asChild variant="outline">
        <Link href="/select-tenant">Volver al inicio</Link>
      </Button>
    </div>
  )
}
