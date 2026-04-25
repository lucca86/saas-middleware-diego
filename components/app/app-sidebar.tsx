"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BarChart3,
  LayoutDashboard,
  Layers,
  Package,
  Plus,
  Ruler,
  ScrollText,
  Settings,
  Share2,
  Sparkles,
  Store,
  Tag,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { SignalLogo } from "@/components/brand/signal-logo"
import { Button } from "@/components/ui/button"
import { TenantSwitcher, type TenantOption } from "@/components/app/tenant-switcher"

interface AppSidebarProps {
  current: TenantOption
  tenants: TenantOption[]
}

export function AppSidebar({ current, tenants }: AppSidebarProps) {
  const pathname = usePathname()
  const base = `/app/${current.slug}`

  const items = [
    { href: `${base}/dashboard`, label: "Dashboard", icon: LayoutDashboard },
    { href: `${base}/products`, label: "Productos", icon: Package },
    { href: `${base}/categories`, label: "Categorías", icon: Tag },
    { href: `${base}/product-types`, label: "Tipos", icon: Layers },
    { href: `${base}/size-curves`, label: "Listas de opciones", icon: Ruler },
    { href: `${base}/storefront`, label: "Storefront", icon: Store },
    { href: `${base}/channels`, label: "Canales", icon: Share2 },
    { href: `${base}/sync`, label: "Sync Logs", icon: ScrollText },
    { href: `${base}/rules`, label: "Reglas", icon: Sparkles },
    { href: `${base}/analytics`, label: "Analytics", icon: BarChart3 },
    { href: `${base}/settings`, label: "Settings", icon: Settings },
  ] as const

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="px-6 pt-6 pb-4">
        <SignalLogo size="md" tagline="High-Fidelity Signal" />
      </div>

      <div className="mx-3 mb-4">
        <TenantSwitcher current={current} tenants={tenants} />
      </div>

      <nav className="flex-1 overflow-y-auto px-3" aria-label="Navegación principal">
        <ul className="flex flex-col gap-1">
          {items.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`)
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 font-sans text-sm transition",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  <span>{label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="border-t border-sidebar-border p-4">
        <Button asChild size="sm" className="w-full shadow-signal">
          <Link href={`${base}/channels/new`}>
            <Plus className="mr-2 h-4 w-4" />
            Deploy New Node
          </Link>
        </Button>
      </div>
    </aside>
  )
}
