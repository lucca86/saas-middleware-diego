"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"
import type { PublicCategory } from "@/lib/storefront/types"

interface Props {
  tenantSlug: string
  categories: PublicCategory[]
  active: string | undefined
  totalCount: number
}

/**
 * Category pills. Switching category preserves the rest of the URL state
 * (search query, sort, in-stock toggle) so the user doesn't lose their
 * context when narrowing/broadening by category.
 */
export function StorefrontCategoryFilter({
  tenantSlug,
  categories,
  active,
  totalCount,
}: Props) {
  const searchParams = useSearchParams()

  function buildHref(slug: string | null) {
    const sp = new URLSearchParams(searchParams?.toString() ?? "")
    if (slug) sp.set("c", slug)
    else sp.delete("c")
    const qs = sp.toString()
    return qs ? `/s/${tenantSlug}?${qs}` : `/s/${tenantSlug}`
  }

  return (
    <div
      className="my-8 flex flex-wrap items-center gap-2"
      role="tablist"
      aria-label="Categorías"
    >
      <FilterPill
        href={buildHref(null)}
        label="Todos"
        count={totalCount}
        active={!active}
      />
      {categories.map((c) => (
        <FilterPill
          key={c.id}
          href={buildHref(c.slug)}
          label={c.name}
          count={c.product_count}
          active={active === c.slug}
        />
      ))}
    </div>
  )
}

function FilterPill({
  href,
  label,
  count,
  active,
}: {
  href: string
  label: string
  count: number
  active: boolean
}) {
  return (
    <Link
      href={href}
      role="tab"
      aria-selected={active}
      scroll={false}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm transition",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground",
      )}
    >
      <span>{label}</span>
      <span
        className={cn(
          "font-mono text-[10px] tabular-nums",
          active ? "text-background/60" : "text-muted-foreground/60",
        )}
      >
        {count}
      </span>
    </Link>
  )
}
