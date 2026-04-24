import Link from "next/link"
import { MailCheck } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function SignUpSuccessPage() {
  return (
    <div className="w-full max-w-md">
      <div className="rounded-lg border border-border/60 bg-card p-8 text-center shadow-signal">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
          <MailCheck className="h-6 w-6 text-primary" aria-hidden="true" />
        </div>
        <h1 className="mt-6 font-display text-3xl font-extrabold tracking-tight">
          Revisá tu email
        </h1>
        <p className="mt-3 font-sans text-sm leading-relaxed text-muted-foreground">
          Te enviamos un enlace de confirmación. Hacé click en él para activar tu cuenta y volver al
          panel.
        </p>
        <Button asChild variant="outline" className="mt-8 w-full bg-transparent">
          <Link href="/auth/login">Volver a iniciar sesión</Link>
        </Button>
      </div>
    </div>
  )
}
