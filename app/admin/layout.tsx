import type { ReactNode } from "react"
import Link from "next/link"
import { redirect } from "next/navigation"
import { ShieldCheck } from "lucide-react"
import { SignOutButton } from "@/components/auth/sign-out-button"
import { ThemeToggle } from "@/components/theme-toggle"
import { isPlatformAdmin } from "@/lib/platform/auth"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/server"
import { AdminNav } from "@/components/admin/admin-nav"

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const allowed = await isPlatformAdmin()
  if (!allowed) redirect("/")

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/40">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between md:gap-4 md:px-6 md:py-4">
          {/* Brand block — wraps next to the title on its own row on mobile. */}
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            <div className="min-w-0">
              <div className="font-display text-base font-semibold tracking-tight text-foreground">
                Panel de plataforma
              </div>
              <div className="truncate text-xs text-muted-foreground">
                Administración de Stockcurve · alcance global
              </div>
            </div>
          </div>

          {/* Actions cluster wraps on small screens so it never overflows. */}
          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            <Badge
              variant="outline"
              className="max-w-[160px] truncate font-mono text-[10px] uppercase tracking-[0.2em] sm:max-w-none"
              title={user.email ?? undefined}
            >
              {user.email}
            </Badge>
            <Link
              href="/select-tenant"
              className="text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              Volver a la app
            </Link>
            <ThemeToggle />
            <SignOutButton />
          </div>
        </div>
      </header>
      {/* Admin shell switches between stacked (mobile) and two-column (desktop). */}
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 md:flex-row md:gap-6 md:px-6 md:py-8">
        <AdminNav />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  )
}
