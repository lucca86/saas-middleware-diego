"use client"

import { useEffect, useState } from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { cn } from "@/lib/utils"

interface ThemeToggleProps {
  className?: string
  /** Show a small label next to the icon (used in the admin header). */
  withLabel?: boolean
}

/**
 * Tiny client-only theme toggle. We render a stable placeholder on first
 * paint and swap to the real icon after mount to avoid hydration mismatches
 * (the actual `theme` value depends on what next-themes reads from
 * localStorage / system, which the server can't know).
 */
export function ThemeToggle({ className, withLabel = false }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const isDark = mounted ? resolvedTheme === "dark" : true
  const next = isDark ? "light" : "dark"

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={`Cambiar a modo ${isDark ? "claro" : "oscuro"}`}
      title={`Cambiar a modo ${isDark ? "claro" : "oscuro"}`}
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-md border border-border/60 bg-background/40 px-2.5 text-xs font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground",
        className,
      )}
    >
      <span className="relative flex h-4 w-4 items-center justify-center" aria-hidden>
        <Sun
          className={cn(
            "h-4 w-4 transition-all",
            mounted && isDark ? "scale-0 -rotate-90 opacity-0" : "scale-100 rotate-0 opacity-100",
          )}
        />
        <Moon
          className={cn(
            "absolute h-4 w-4 transition-all",
            mounted && isDark ? "scale-100 rotate-0 opacity-100" : "scale-0 rotate-90 opacity-0",
          )}
        />
      </span>
      {withLabel ? (
        <span suppressHydrationWarning>{mounted ? (isDark ? "Oscuro" : "Claro") : "Tema"}</span>
      ) : null}
    </button>
  )
}
