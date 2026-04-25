import Link from "next/link"

export default function StorefrontNotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">404</p>
      <h1 className="mt-3 font-display text-3xl font-extrabold leading-tight text-foreground text-balance">
        Esta tienda todavía no está disponible
      </h1>
      <p className="mt-3 text-pretty text-sm text-muted-foreground">
        Puede ser un link viejo, un error de tipeo, o la tienda todavía no fue publicada.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex items-center rounded-md border border-border px-4 py-2 text-sm transition hover:bg-accent hover:text-accent-foreground"
      >
        Volver al inicio
      </Link>
    </div>
  )
}
