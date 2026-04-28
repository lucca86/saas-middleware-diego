"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Search, SlidersHorizontal, X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { PublicSort } from "@/lib/storefront/queries"

interface Props {
  tenantSlug: string
  initialQuery: string
  initialSort: PublicSort
  initialInStock: boolean
}

const SORT_OPTIONS: { value: PublicSort; label: string }[] = [
  { value: "newest", label: "Más nuevos" },
  { value: "price-asc", label: "Precio: menor a mayor" },
  { value: "price-desc", label: "Precio: mayor a menor" },
  { value: "name", label: "Nombre A-Z" },
]

/**
 * Sticky search + sort + in-stock controls. Updates the URL via shallow
 * navigation (preserving the current pathname and category slug `c`), and
 * debounces the text input so we don't hammer the server with one
 * navigation per keystroke.
 */
export function StorefrontSearchBar({
  tenantSlug,
  initialQuery,
  initialSort,
  initialInStock,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [pending, start] = useTransition()
  const [text, setText] = useState(initialQuery)

  // Debounce text → URL
  useEffect(() => {
    if (text === initialQuery) return
    const t = window.setTimeout(() => {
      pushUpdate({ q: text || undefined })
    }, 320)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text])

  function pushUpdate(updates: Record<string, string | undefined | boolean>) {
    const sp = new URLSearchParams(searchParams?.toString() ?? "")
    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined || value === "" || value === false) {
        sp.delete(key)
      } else {
        sp.set(key, String(value))
      }
    }
    const qs = sp.toString()
    start(() => {
      router.replace(qs ? `/s/${tenantSlug}?${qs}` : `/s/${tenantSlug}`, {
        scroll: false,
      })
    })
  }

  const sort = (searchParams?.get("sort") as PublicSort) ?? initialSort
  const inStock =
    searchParams?.get("stock") === "1" ? true : initialInStock

  return (
    <div
      className={cn(
        "sticky top-[68px] z-20 -mx-4 mb-6 border-y border-border/60 bg-background/85 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/70 md:-mx-6 md:px-6",
        pending && "opacity-80",
      )}
      data-testid="storefront-search-bar"
    >
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
        <label className="relative flex-1">
          <span className="sr-only">Buscar productos</span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Buscar productos..."
            className="h-10 w-full rounded-md border border-border bg-card pl-9 pr-9 text-sm outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-foreground/20"
          />
          {text ? (
            <button
              type="button"
              onClick={() => {
                setText("")
                pushUpdate({ q: undefined })
              }}
              className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground transition hover:bg-accent hover:text-foreground"
              aria-label="Limpiar búsqueda"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </label>

        <div className="flex items-center gap-2">
          <label className="relative">
            <span className="sr-only">Ordenar</span>
            <SlidersHorizontal
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <select
              value={sort}
              onChange={(e) => pushUpdate({ sort: e.target.value })}
              className="h-10 appearance-none rounded-md border border-border bg-card pl-8 pr-8 text-sm outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-foreground/20"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-border bg-card px-3 text-sm">
            <input
              type="checkbox"
              checked={inStock}
              onChange={(e) => pushUpdate({ stock: e.target.checked ? "1" : undefined })}
              className="h-3.5 w-3.5 cursor-pointer accent-foreground"
            />
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Solo stock
            </span>
          </label>
        </div>
      </div>
    </div>
  )
}
