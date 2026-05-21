"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BarChart3,
  BookOpen,
  Boxes,
  LayoutDashboard,
  Layers,
  Package,
  Plus,
  Receipt,
  Ruler,
  Settings,
  Share2,
  ShieldCheck,
  Sparkles,
  Store,
  Tag,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { SignalLogo } from "@/components/brand/signal-logo"
import { Button } from "@/components/ui/button"
import { TenantSwitcher, type TenantOption } from "@/components/app/tenant-switcher"

interface SidebarBodyProps {
  current: TenantOption
  tenants: TenantOption[]
  isPlatformAdmin?: boolean
  /**
   * Called whenever the user navigates from the sidebar. Used by the mobile
   * drawer to close itself; desktop passes nothing.
   */
  onNavigate?: () => void
}

/**
 * Inner content of the navigation sidebar — extracted so we can render it
 * both as a fixed `<aside>` on desktop and inside a Sheet on mobile without
 * duplicating the link list and the active-state logic.
 */
export function SidebarBody({
  current,
  tenants,
  isPlatformAdmin = false,
  onNavigate,
}: SidebarBodyProps) {
  const pathname = usePathname()
  const base = `/app/${current.slug}`

  const items = [
    { href: `${base}/dashboard`, label: "Dashboard", icon: LayoutDashboard },
    { href: `${base}/products`, label: "Productos", icon: Package },
    { href: `${base}/stock`, label: "Stock", icon: Boxes },
    { href: `${base}/orders`, label: "Pedidos", icon: Receipt },
    { href: `${base}/categories`, label: "Categorías", icon: Tag },
    { href: `${base}/product-types`, label: "Tipos", icon: Layers },
    { href: `${base}/size-curves`, label: "Listas de opciones", icon: Ruler },
    { href: `${base}/storefront`, label: "Storefront", icon: Store },
    { href: `${base}/channels`, label: "Canales", icon: Share2 },
    { href: `${base}/rules`, label: "Reglas", icon: Sparkles },
    { href: `${base}/analytics`, label: "Analytics", icon: BarChart3 },
    { href: `${base}/manual`, label: "Manual", icon: BookOpen },
    { href: `${base}/settings`, label: "Settings", icon: Settings },
  ] as const

  return (
    <>
      <div className="px-6 pb-4 pt-6">
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
                  onClick={onNavigate}
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

      {isPlatformAdmin ? (
        <div className="mx-3 mb-2 mt-1">
          <Link
            href="/admin"
            onClick={onNavigate}
            className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-medium text-primary transition hover:bg-primary/15"
          >
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            Panel de plataforma
          </Link>
        </div>
      ) : null}

      <div className="border-t border-sidebar-border p-4">
        <Button
          asChild
          size="sm"
          className="w-full shadow-signal"
          title="Conectar un nuevo canal de venta (storefront, marketplace, feed)."
        >
          <Link href={`${base}/channels/new`} onClick={onNavigate}>
            <Plus className="mr-2 h-4 w-4" />
            Deploy New Node
          </Link>
        </Button>
        <Link
          href={`${base}/manual/canales-y-deploy-new-node`}
          onClick={onNavigate}
          className="mt-2 block text-center font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
        >
          ¿Qué es un node?
        </Link>
      </div>
    </>
  )
}
