"use client"

import { LogOut, Settings, Users } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export interface UserMenuProps {
  fullName: string | null
  email: string | null
  avatarUrl: string | null
  tenantSlug: string
}

function initials(source: string | null) {
  if (!source) return "?"
  return source
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

export function UserMenu({ fullName, email, avatarUrl, tenantSlug }: UserMenuProps) {
  const label = fullName || email || "Mi cuenta"
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/auth/login")
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-md transition hover:ring-2 hover:ring-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="Menú de usuario"
        >
          <Avatar className="h-8 w-8 border border-border/60">
            {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
            <AvatarFallback className="bg-surface-container text-[11px] font-semibold text-foreground">
              {initials(fullName || email)}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-60">
        <DropdownMenuLabel className="flex flex-col gap-0.5 pb-2">
          <span className="truncate text-sm font-semibold text-foreground">{label}</span>
          {email && (
            <span className="truncate font-mono text-[11px] text-muted-foreground">{email}</span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href={`/app/${tenantSlug}/settings`} className="cursor-pointer">
            <Settings className="mr-2 h-4 w-4" />
            Configuración del espacio
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={`/app/${tenantSlug}/settings/members`} className="cursor-pointer">
            <Users className="mr-2 h-4 w-4" />
            Equipo y miembros
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer text-destructive focus:text-destructive"
          onSelect={handleSignOut}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
