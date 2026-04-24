import Link from "next/link"
import { SignUpForm } from "@/components/auth/sign-up-form"

export default function SignUpPage() {
  return (
    <div className="w-full max-w-md">
      <div className="mb-8 text-center">
        <h1 className="font-display text-4xl font-extrabold tracking-tight">Crear cuenta</h1>
        <p className="mt-2 font-sans text-sm text-muted-foreground">
          Conectá tu ERP y tus canales en minutos
        </p>
      </div>

      <div className="rounded-lg border border-border/60 bg-card p-6 shadow-signal">
        <SignUpForm />
      </div>

      <p className="mt-6 text-center font-sans text-sm text-muted-foreground">
        {"¿Ya tenés cuenta? "}
        <Link href="/auth/login" className="font-semibold text-primary hover:underline">
          Iniciar sesión
        </Link>
      </p>
    </div>
  )
}
