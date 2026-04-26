"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useMemo, useState } from "react"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  MANUAL_ARTICLES,
  MANUAL_CATEGORIES,
  type ManualSearchIndex,
} from "@/lib/manual/articles"

interface Props {
  tenantSlug: string
  index: ManualSearchIndex[]
  children: React.ReactNode
}

/**
 * Two-pane shell: left navigation (categorized + searchable), right content.
 * The search filter happens entirely client-side over the pre-built index.
 */
export function ManualShell({ tenantSlug, index, children }: Props) {
  const pathname = usePathname()
  const [query, setQuery] = useState("")

  const base = `/app/${tenantSlug}/manual`

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length === 0) return null
    return index
      .filter((it) => it.haystack.includes(q))
      .map((it) => it.slug)
  }, [query, index])

  return (
    <div className="grid gap-8 lg:grid-cols-[260px_1fr] lg:gap-10">
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            placeholder="Buscar en el manual…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
            aria-label="Buscar en el manual"
          />
        </div>

        <nav className="mt-6 flex flex-col gap-6" aria-label="Secciones del manual">
          {MANUAL_CATEGORIES.map((cat) => {
            const articles = MANUAL_ARTICLES.filter((a) => a.category === cat.id).filter(
              (a) => matches === null || matches.includes(a.slug),
            )
            if (articles.length === 0) return null
            return (
              <div key={cat.id}>
                <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  {cat.label}
                </p>
                <ul className="flex flex-col">
                  {articles.map((a) => {
                    const href = `${base}/${a.slug}`
                    const active = pathname === href
                    return (
                      <li key={a.slug}>
                        <Link
                          href={href}
                          className={cn(
                            "block rounded-md px-2 py-1.5 text-sm leading-snug transition",
                            active
                              ? "bg-primary/10 text-primary"
                              : "text-foreground/80 hover:bg-card/60 hover:text-foreground",
                          )}
                          aria-current={active ? "page" : undefined}
                        >
                          {a.title}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
          {matches !== null && matches.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin resultados para &ldquo;{query}&rdquo;.</p>
          ) : null}
        </nav>
      </aside>

      <main className="min-w-0">{children}</main>
    </div>
  )
}
