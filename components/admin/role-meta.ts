import type { TenantRoleName } from "@/app/admin/actions"

export const ROLE_LABEL: Record<TenantRoleName, string> = {
  owner: "Owner",
  admin: "Admin (tenant)",
  operator: "Operator",
  viewer: "Viewer",
}

export const ROLE_VARIANT: Record<TenantRoleName, string> = {
  owner: "border-primary/40 bg-primary/15 text-primary",
  admin: "border-primary/30 bg-primary/10 text-primary",
  operator: "border-secondary/40 bg-secondary text-secondary-foreground",
  viewer: "border-border bg-muted text-muted-foreground",
}

export const ROLE_OPTIONS = Object.keys(ROLE_LABEL) as TenantRoleName[]

export type AdminTenant = { id: string; slug: string; name: string }
