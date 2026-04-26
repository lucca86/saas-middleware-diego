"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

type Item = { href: string; label: string; icon: LucideIcon }

export function AdminNav({ items }: { items: readonly Item[] }) {
  const pathname = usePathname()
  return (
    <nav className="w-48 shrink-0">
      <ul className="flex flex-col gap-1">
        {items.map((it) => {
          const Icon = it.icon
          const active = pathname === it.href || (it.href !== "/admin" && pathname.startsWith(it.href))
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
