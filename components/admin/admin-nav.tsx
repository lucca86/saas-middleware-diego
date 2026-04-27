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

export function AdminNav() {
  const pathname = usePathname()
  return (
    <nav className="w-48 shrink-0">
      <ul className="flex flex-col gap-1">
        {ITEMS.map((it) => {
          const Icon = it.icon
          const active =
            pathname === it.href || (it.href !== "/admin" && pathname.startsWith(it.href))
          return (
            <li key={it.href}>
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
