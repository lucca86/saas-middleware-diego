import { Bell, HelpCircle, Search } from "lucide-react"
import { UserMenu } from "@/components/app/user-menu"
import { ThemeToggle } from "@/components/theme-toggle"
import { AppMobileNav } from "@/components/app/app-mobile-nav"
import type { TenantOption } from "@/components/app/tenant-switcher"

interface AppTopbarProps {
  /** Tenant data needed to render the mobile drawer trigger. */
  current: TenantOption
  tenants: TenantOption[]
  isPlatformAdmin?: boolean
  fullName: string | null
  email: string | null
  avatarUrl: string | null
}

/**
 * Top app bar. Mobile layout: hamburger + tenant name + a compact actions
 * cluster (theme + user menu). Desktop layout: search input takes the
 * available width and the actions cluster includes notifications/help.
 */
export function AppTopbar({
  current,
  tenants,
  isPlatformAdmin = false,
  fullName,
  email,
  avatarUrl,
}: AppTopbarProps) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border/60 bg-background/80 px-3 backdrop-blur md:h-16 md:gap-3 md:px-6">
      <AppMobileNav current={current} tenants={tenants} isPlatformAdmin={isPlatformAdmin} />

      {/* Mobile-only: tenant title where the search would normally be. */}
      <div className="flex min-w-0 flex-1 items-center md:hidden">
        <span className="truncate font-display text-sm font-bold tracking-tight text-foreground">
          {current.name}
        </span>
      </div>

      {/* Desktop search. Hidden on mobile to free vertical and horizontal space. */}
      <div className="hidden w-full max-w-xl items-center gap-3 rounded-md border border-border/60 bg-input/40 px-3 py-2 md:flex">
        <Search className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <input
          type="search"
          placeholder="Buscar señales, productos, logs..."
          aria-label="Buscar"
          className="w-full bg-transparent font-sans text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
      </div>

      <div className="flex items-center gap-1 md:gap-2">
        <button
          aria-label="Notificaciones"
          className="hidden h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground md:flex"
        >
          <Bell className="h-4 w-4" />
        </button>
        <button
          aria-label="Ayuda"
          className="hidden h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground md:flex"
        >
          <HelpCircle className="h-4 w-4" />
        </button>
        <ThemeToggle />
        <div
          className="ml-1 hidden h-6 w-px bg-border md:ml-2 md:block"
          aria-hidden="true"
        />
        <UserMenu
          tenantSlug={current.slug}
          fullName={fullName}
          email={email}
          avatarUrl={avatarUrl}
        />
      </div>
    </header>
  )
}
