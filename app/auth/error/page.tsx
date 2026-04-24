import Link from "next/link"
import { AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  return (
    <div className="w-full max-w-md">
      <div className="rounded-lg border border-destructive/20 bg-card p-8 text-center shadow-signal-destructive">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-destructive/10">
          <AlertCircle className="h-6 w-6 text-destructive" aria-hidden="true" />
        </div>
        <h1 className="mt-6 font-display text-3xl font-extrabold tracking-tight">
          No pudimos autenticarte
        </h1>
        <p className="mt-3 font-sans text-sm leading-relaxed text-muted-foreground">
          {error ?? "Ocurrió un problema al procesar tu enlace. Intentá iniciar sesión nuevamente."}
        </p>
        <Button asChild className="mt-8 w-full">
          <Link href="/auth/login">Ir a iniciar sesión</Link>
        </Button>
      </div>
    </div>
  )
}
