"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Building2, Users } from "lucide-react"
import { cn } from "@/lib/utils"

export function SettingsTabs({ tenantSlug }: { tenantSlug: string }) {
  const pathname = usePathname()
  const base = `/app/${tenantSlug}/settings`

  const tabs = [
    { href: base, label: "General", icon: Building2, exact: true },
    { href: `${base}/members`, label: "Miembros", icon: Users },
  ]

  return (
    <nav
      className="flex items-center gap-1 border-b border-outline-variant"
      aria-label="Secciones de configuración"
    >
      {tabs.map((tab) => {
        const isActive = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href)
        const Icon = tab.icon
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "group relative inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors",
              isActive
                ? "border-primary text-primary"
                : "border-transparent text-on-surface-variant hover:text-on-surface",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
