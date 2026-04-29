import { SidebarBody } from "@/components/app/sidebar-body"
import type { TenantOption } from "@/components/app/tenant-switcher"

interface AppSidebarProps {
  current: TenantOption
  tenants: TenantOption[]
  isPlatformAdmin?: boolean
}

/**
 * Desktop-only sidebar. On mobile we render the same content inside a Sheet
 * triggered from the topbar (see `AppMobileNav`). Hiding the aside outright
 * on small screens keeps it out of the layout flow so the main column gets
 * the full viewport width.
 */
export function AppSidebar({ current, tenants, isPlatformAdmin = false }: AppSidebarProps) {
  return (
    <aside className="hidden h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
      <SidebarBody
        current={current}
        tenants={tenants}
        isPlatformAdmin={isPlatformAdmin}
      />
    </aside>
  )
}
