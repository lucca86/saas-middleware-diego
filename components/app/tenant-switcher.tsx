"use client"

import { useState } from "react"
import Link from "next/link"
import { Check, ChevronsUpDown, Plus } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export interface TenantOption {
  id: string
  slug: string
  name: string
  plan: string
  role: string
}

interface TenantSwitcherProps {
  current: TenantOption
  tenants: TenantOption[]
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

export function TenantSwitcher({ current, tenants }: TenantSwitcherProps) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-md border border-sidebar-border bg-sidebar-accent/40 px-3 py-2 text-left transition hover:border-primary/30 hover:bg-sidebar-accent/60"
          aria-label="Cambiar espacio de trabajo"
          aria-expanded={open}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-primary/10 font-display text-xs font-extrabold text-primary">
            {initials(current.name)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-sm font-bold tracking-tight text-sidebar-foreground">
              {current.name}
            </p>
            <p className="truncate font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {current.role} · {current.plan}
            </p>
          </div>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-[260px] p-0"
      >
        <div className="border-b border-border/60 px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Tus espacios
          </p>
        </div>
        <ul className="max-h-72 overflow-y-auto p-1" role="listbox">
          {tenants.map((t) => {
            const isActive = t.id === current.id
            return (
              <li key={t.id} role="option" aria-selected={isActive}>
                <Link
                  href={`/app/${t.slug}/dashboard`}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-2 rounded px-2 py-2 text-sm transition",
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "text-foreground hover:bg-accent/60",
                  )}
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-primary/10 font-display text-[10px] font-extrabold text-primary">
                    {initials(t.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{t.name}</p>
                    <p className="truncate font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      {t.role}
                    </p>
                  </div>
                  {isActive && <Check className="h-4 w-4 shrink-0 text-primary" />}
                </Link>
              </li>
            )
          })}
        </ul>
        <div className="border-t border-border/60 p-1">
          <Link
            href="/onboarding"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded px-2 py-2 text-sm text-muted-foreground transition hover:bg-accent/60 hover:text-foreground"
          >
            <Plus className="h-4 w-4" />
            Crear nuevo espacio
          </Link>
          <Link
            href="/select-tenant"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded px-2 py-2 text-sm text-muted-foreground transition hover:bg-accent/60 hover:text-foreground"
          >
            Ver todos
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  )
}
