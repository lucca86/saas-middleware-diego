import type { ReactNode } from "react"
import Link from "next/link"
import { redirect } from "next/navigation"
import { ShieldCheck } from "lucide-react"
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
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-primary" aria-hidden />
            <div>
              <div className="font-display text-base font-semibold tracking-tight text-foreground">
                Panel de plataforma
              </div>
              <div className="text-xs text-muted-foreground">
                Administración de Stockcurve · alcance global
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-[0.2em]">
              {user.email}
            </Badge>
            <Link
              href="/"
              className="text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              Volver a la app
            </Link>
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-6xl gap-6 px-6 py-8">
        <AdminNav />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  )
}
