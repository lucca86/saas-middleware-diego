"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Building2, ShieldCheck, Users } from "lucide-react"
import { cn } from "@/lib/utils"

// Items live inside this client component on purpose. The layout that hosts
// the nav is a server component, and React Server Components cannot serialize
// function references (lucide icon components are functions) across the
// boundary. Defining items here keeps the API a plain client tree.
const ITEMS = [
  { href: "/admin", label: "Resumen", icon: ShieldCheck },
  { href: "/admin/tenants", label: "Tenants", icon: Building2 },
  { href: "/admin/users", label: "Usuarios", icon: Users },
] as const

/**
 * Admin sidebar.
 *  - Mobile: horizontal scrollable tab strip — each item shrinks to icon+label,
 *    the whole strip lives in a thin band under the header.
 *  - Desktop (md+): the original 48-wide vertical column.
 */
export function AdminNav() {
  const pathname = usePathname()
  return (
    <nav
      aria-label="Secciones de plataforma"
      className="-mx-4 border-b border-border md:mx-0 md:w-48 md:shrink-0 md:border-0"
    >
      <ul className="flex flex-row gap-1 overflow-x-auto whitespace-nowrap px-4 pb-2 md:flex-col md:overflow-visible md:px-0 md:pb-0">
        {ITEMS.map((it) => {
          const Icon = it.icon
          const active =
            pathname === it.href || (it.href !== "/admin" && pathname.startsWith(it.href))
          return (
            <li key={it.href} className="shrink-0 md:shrink">
              <Link
                href={it.href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {it.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
