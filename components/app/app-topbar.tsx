import { Bell, HelpCircle, Search } from "lucide-react"
import { UserMenu } from "@/components/app/user-menu"
import { ThemeToggle } from "@/components/theme-toggle"

interface AppTopbarProps {
  tenantSlug: string
  fullName: string | null
  email: string | null
  avatarUrl: string | null
}

export function AppTopbar({ tenantSlug, fullName, email, avatarUrl }: AppTopbarProps) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-border/60 bg-background/80 px-6 backdrop-blur">
      <div className="flex w-full max-w-xl items-center gap-3 rounded-md border border-border/60 bg-input/40 px-3 py-2">
        <Search className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <input
          type="search"
          placeholder="Buscar señales, productos, logs..."
          aria-label="Buscar"
          className="w-full bg-transparent font-sans text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          aria-label="Notificaciones"
          className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground"
        >
          <Bell className="h-4 w-4" />
        </button>
        <button
          aria-label="Ayuda"
          className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground"
        >
          <HelpCircle className="h-4 w-4" />
        </button>
        <ThemeToggle />
        <div className="ml-2 h-6 w-px bg-border" aria-hidden="true" />
        <UserMenu
          tenantSlug={tenantSlug}
          fullName={fullName}
          email={email}
          avatarUrl={avatarUrl}
        />
      </div>
    </header>
  )
}
