import Link from "next/link"
import { LoginForm } from "@/components/auth/login-form"

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams

  return (
    <div className="w-full max-w-md">
      <div className="mb-8 text-center">
        <h1 className="font-display text-4xl font-extrabold tracking-tight">
          Iniciar sesión
        </h1>
        <p className="mt-2 font-sans text-sm text-muted-foreground">
          Accedé a tu panel de control de SignalCore
        </p>
      </div>

      <div className="rounded-lg border border-border/60 bg-card p-6 shadow-signal">
        <LoginForm next={next} />
      </div>

      <p className="mt-6 text-center font-sans text-sm text-muted-foreground">
        {"¿No tenés cuenta todavía? "}
        <Link href="/auth/sign-up" className="font-semibold text-primary hover:underline">
          Crear una
        </Link>
      </p>
    </div>
  )
}
