import Link from "next/link"
import { ChevronRight } from "lucide-react"

interface Crumb {
  href?: string
  label: string
}

/**
 * Lightweight breadcrumbs for the storefront. The last crumb is rendered as
 * plain text (current page); any crumb with an `href` is a link.
 */
export function StorefrontBreadcrumbs({ items }: { items: Crumb[] }) {
  if (items.length === 0) return null
  return (
    <nav aria-label="Migas de pan" className="mb-4">
      <ol className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
        {items.map((c, i) => {
          const isLast = i === items.length - 1
          return (
            <li key={`${c.label}-${i}`} className="flex items-center gap-1">
              {c.href && !isLast ? (
                <Link
                  href={c.href}
                  className="rounded transition hover:text-foreground"
                >
                  {c.label}
                </Link>
              ) : (
                <span className={isLast ? "text-foreground" : undefined}>
                  {c.label}
                </span>
              )}
              {!isLast ? (
                <ChevronRight
                  className="h-3 w-3 text-muted-foreground/60"
                  aria-hidden="true"
                />
              ) : null}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
