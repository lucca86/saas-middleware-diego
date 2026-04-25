import Link from "next/link"
import { cn } from "@/lib/utils"
import type { PublicCategory } from "@/lib/storefront/types"

interface Props {
  tenantSlug: string
  categories: PublicCategory[]
  active: string | undefined
  totalCount: number
}

export function StorefrontCategoryFilter({
  tenantSlug,
  categories,
  active,
  totalCount,
}: Props) {
  return (
    <div className="my-8 flex flex-wrap items-center gap-2" role="tablist" aria-label="Categorías">
      <FilterPill
        href={`/s/${tenantSlug}`}
        label="Todos"
        count={totalCount}
        active={!active}
      />
      {categories.map((c) => (
        <FilterPill
          key={c.id}
          href={`/s/${tenantSlug}?c=${encodeURIComponent(c.slug)}`}
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
