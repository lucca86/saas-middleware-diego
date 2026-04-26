import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, ArrowRight } from "lucide-react"
import {
  MANUAL_ARTICLES,
  MANUAL_CATEGORIES,
  getArticle,
} from "@/lib/manual/articles"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const article = getArticle(slug)
  if (!article) return { title: "Manual" }
  return {
    title: `${article.title} · Manual`,
    description: article.summary,
  }
}

export default async function ManualArticlePage({
  params,
}: {
  params: Promise<{ tenant: string; slug: string }>
}) {
  const { tenant, slug } = await params
  const article = getArticle(slug)
  if (!article) notFound()

  const base = `/app/${tenant}/manual`
  const idx = MANUAL_ARTICLES.findIndex((a) => a.slug === article.slug)
  const prev = idx > 0 ? MANUAL_ARTICLES[idx - 1] : null
  const next = idx < MANUAL_ARTICLES.length - 1 ? MANUAL_ARTICLES[idx + 1] : null
  const category = MANUAL_CATEGORIES.find((c) => c.id === article.category)

  const Body = article.content

  return (
    <article className="max-w-3xl">
      <Link
        href={base}
        className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" aria-hidden="true" />
        Volver al manual
      </Link>

      <header className="mt-3">
        {category ? (
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            {category.label}
          </p>
        ) : null}
        <h1 className="mt-1 font-display text-3xl font-extrabold leading-tight text-foreground text-balance">
          {article.title}
        </h1>
        <p className="mt-2 text-pretty text-sm leading-relaxed text-muted-foreground">
          {article.summary}
        </p>
      </header>

      <div className="prose-manual mt-6">
        <Body />
      </div>

      <nav
        className="mt-12 flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-stretch sm:justify-between"
        aria-label="Artículos relacionados"
      >
        {prev ? (
          <Link
            href={`${base}/${prev.slug}`}
            className="group flex flex-1 flex-col rounded-md border border-border bg-card/30 px-4 py-3 transition hover:border-primary/40 hover:bg-card/60"
          >
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Anterior
            </span>
            <span className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
              <ArrowLeft className="h-3.5 w-3.5 transition group-hover:-translate-x-0.5" aria-hidden="true" />
              {prev.title}
            </span>
          </Link>
        ) : (
          <span className="hidden flex-1 sm:block" />
        )}
        {next ? (
          <Link
            href={`${base}/${next.slug}`}
            className="group flex flex-1 flex-col items-end rounded-md border border-border bg-card/30 px-4 py-3 transition hover:border-primary/40 hover:bg-card/60"
          >
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Siguiente
            </span>
            <span className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
              {next.title}
              <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" aria-hidden="true" />
            </span>
          </Link>
        ) : null}
      </nav>
    </article>
  )
}
