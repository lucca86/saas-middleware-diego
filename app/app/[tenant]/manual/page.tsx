import Link from "next/link"
import { ArrowRight } from "lucide-react"
import {
  MANUAL_ARTICLES,
  MANUAL_CATEGORIES,
} from "@/lib/manual/articles"

export default async function ManualHome({
  params,
}: {
  params: Promise<{ tenant: string }>
}) {
  const { tenant } = await params
  const base = `/app/${tenant}/manual`

  return (
    <div className="space-y-8">
      <section className="rounded-lg border border-border bg-card/40 p-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Por dónde empezar
        </p>
        <h2 className="mt-1 font-display text-xl font-bold text-foreground">
          ¿Es tu primera vez en Pulpo?
        </h2>
        <p className="mt-2 max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground">
          Leé estos tres artículos en orden y tenés todo el modelo mental para
          operar la app sin sorpresas.
        </p>
        <ul className="mt-4 flex flex-col gap-2">
          {[
            { slug: "bienvenida", label: "Bienvenida al manual" },
            { slug: "arquitectura", label: "Arquitectura: tenants y multi-tenancy" },
            { slug: "roles-y-permisos", label: "Roles y permisos" },
          ].map((it) => (
            <li key={it.slug}>
              <Link
                href={`${base}/${it.slug}`}
                className="group inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
              >
                {it.label}
                <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-display text-lg font-bold text-foreground">Por sección</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {MANUAL_CATEGORIES.map((cat) => {
            const count = MANUAL_ARTICLES.filter((a) => a.category === cat.id).length
            const Icon = cat.icon
            return (
              <Link
                key={cat.id}
                href={`${base}/${MANUAL_ARTICLES.find((a) => a.category === cat.id)?.slug ?? ""}`}
                className="group flex items-start gap-3 rounded-lg border border-border bg-card/30 p-4 transition hover:border-primary/40 hover:bg-card/60"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="font-display text-sm font-semibold text-foreground">{cat.label}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {cat.description}
                  </p>
                  <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    {count} {count === 1 ? "artículo" : "artículos"}
                  </p>
                </div>
              </Link>
            )
          })}
        </div>
      </section>

      <section>
        <h2 className="font-display text-lg font-bold text-foreground">Todos los artículos</h2>
        <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
          {MANUAL_ARTICLES.map((a) => (
            <li key={a.slug}>
              <Link
                href={`${base}/${a.slug}`}
                className="flex items-center justify-between gap-4 px-4 py-3 text-sm transition hover:bg-card/60"
              >
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{a.title}</p>
                  <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{a.summary}</p>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
