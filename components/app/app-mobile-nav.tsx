"use client"

import { useState } from "react"
import { Menu } from "lucide-react"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { SidebarBody } from "@/components/app/sidebar-body"
import type { TenantOption } from "@/components/app/tenant-switcher"

interface AppMobileNavProps {
  current: TenantOption
  tenants: TenantOption[]
  isPlatformAdmin?: boolean
}

/**
 * Hamburger button that lives in the topbar on small screens. Opens a Sheet
 * containing the same content as the desktop sidebar. We close the drawer on
 * navigation via the `onNavigate` callback so the next page is visible
 * immediately on tap.
 */
export function AppMobileNav({ current, tenants, isPlatformAdmin }: AppMobileNavProps) {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label="Abrir menú"
        className="-ml-1 flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground md:hidden"
      >
        <Menu className="h-5 w-5" />
      </SheetTrigger>
      <SheetContent
        side="left"
        className="flex w-72 max-w-[85vw] flex-col border-r border-sidebar-border bg-sidebar p-0"
      >
        {/* Visually hidden title for a11y — Radix requires a SheetTitle. */}
        <SheetTitle className="sr-only">Menú</SheetTitle>
        <SidebarBody
          current={current}
          tenants={tenants}
          isPlatformAdmin={isPlatformAdmin}
          onNavigate={() => setOpen(false)}
        />
      </SheetContent>
    </Sheet>
  )
}
