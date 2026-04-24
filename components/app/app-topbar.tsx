import Link from "next/link"
import { Bell, HelpCircle, Search, User2 } from "lucide-react"
import { SignOutButton } from "@/components/auth/sign-out-button"

export function AppTopbar() {
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
        <Link
          href="/select-tenant"
          aria-label="Cambiar espacio"
          className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground"
        >
          <User2 className="h-4 w-4" />
        </Link>
        <div className="ml-2 h-6 w-px bg-border" aria-hidden="true" />
        <SignOutButton />
      </div>
    </header>
  )
}
