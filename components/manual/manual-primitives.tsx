import type { ReactNode } from "react"
import { AlertTriangle, Info, Lightbulb, ShieldCheck } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Reusable building blocks used inside manual articles. Kept in one file so
 * each article stays focused on its content and the visual language stays
 * consistent across the help center.
 */

interface CalloutProps {
  variant?: "info" | "warning" | "tip" | "shield"
  title?: string
  children: ReactNode
}

const calloutStyles: Record<NonNullable<CalloutProps["variant"]>, { bar: string; icon: typeof Info }> = {
  info: { bar: "border-l-primary/70 bg-primary/5", icon: Info },
  warning: { bar: "border-l-destructive/70 bg-destructive/5", icon: AlertTriangle },
  tip: { bar: "border-l-success/70 bg-success/5", icon: Lightbulb },
  shield: { bar: "border-l-foreground/40 bg-card/60", icon: ShieldCheck },
}

export function Callout({ variant = "info", title, children }: CalloutProps) {
  const { bar, icon: Icon } = calloutStyles[variant]
  return (
    <aside
      className={cn(
        "my-5 flex gap-3 rounded-md border border-border border-l-4 px-4 py-3",
        bar,
      )}
      role="note"
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-foreground/80" aria-hidden="true" />
      <div className="flex flex-col gap-1 text-sm leading-relaxed">
        {title ? <p className="font-display text-sm font-semibold text-foreground">{title}</p> : null}
        <div className="text-foreground/90">{children}</div>
      </div>
    </aside>
  )
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex items-center rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground/80">
      {children}
    </kbd>
  )
}

interface RoleBadgeProps {
  scope: "system" | "tenant"
  role: string
}

const roleColors: Record<string, string> = {
  superadmin: "bg-foreground text-background",
  owner: "bg-primary text-primary-foreground",
  admin: "bg-primary/15 text-primary",
  operator: "bg-success/15 text-success",
  viewer: "bg-muted text-muted-foreground",
}

export function RoleBadge({ scope, role }: RoleBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[11px] uppercase tracking-[0.14em]",
        roleColors[role] ?? "bg-muted text-muted-foreground",
      )}
    >
      <span className="opacity-60">{scope === "system" ? "sys" : "tenant"}</span>
      {role}
    </span>
  )
}

export function GlossaryTerm({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1 border-b border-border py-3 last:border-b-0 md:grid-cols-[200px_1fr] md:gap-6">
      <dt className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground md:pt-0.5">
        {term}
      </dt>
      <dd className="text-sm leading-relaxed text-foreground">{children}</dd>
    </div>
  )
}

export function StepList({ steps }: { steps: ReactNode[] }) {
  return (
    <ol className="my-4 flex flex-col gap-3">
      {steps.map((step, idx) => (
        <li key={idx} className="flex gap-3">
          <span
            className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-[11px] font-semibold text-primary"
            aria-hidden="true"
          >
            {idx + 1}
          </span>
          <div className="text-sm leading-relaxed text-foreground/90">{step}</div>
        </li>
      ))}
    </ol>
  )
}
