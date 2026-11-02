"use client"

import { useEffect, useState, useTransition } from "react"
import { Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import {
  addTenantMembership,
  removeTenantMembership,
  updateMembershipRole,
  type TenantRoleName,
} from "@/app/admin/actions"
import type { PlatformUser } from "@/lib/platform/queries"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ROLE_LABEL, ROLE_OPTIONS, ROLE_VARIANT, type AdminTenant } from "./role-meta"

type Membership = PlatformUser["memberships"][number]

/**
 * Role chip for an existing membership. Opens a popover to change the role
 * or remove the user from the tenant (no more one-click destructive removal).
 */
export function MembershipChip({ userId, membership }: { userId: string; membership: Membership }) {
  const role = membership.role as TenantRoleName
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()

  function handleRoleChange(next: string) {
    if (next === role) return
    start(async () => {
      const res = await updateMembershipRole({
        userId,
        tenantId: membership.tenant_id,
        role: next as TenantRoleName,
      })
      if (!res.ok) toast.error(res.error)
      else {
        toast.success(`Rol actualizado a ${ROLE_LABEL[next as TenantRoleName]}`)
        setOpen(false)
      }
    })
  }

  function handleRemove() {
    start(async () => {
      const res = await removeTenantMembership(userId, membership.tenant_id)
      if (!res.ok) toast.error(res.error)
      else {
        toast.success("Membresía removida")
        setOpen(false)
      }
    })
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={pending}
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition hover:brightness-125 ${
            ROLE_VARIANT[role] ?? ROLE_VARIANT.viewer
          }`}
          title="Cambiar rol o quitar del tenant"
        >
          <span className="font-mono">/{membership.tenant_slug}</span>
          <span className="opacity-70">· {ROLE_LABEL[role] ?? membership.role}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 space-y-3">
        <div>
          <div className="text-sm font-medium text-foreground">{membership.tenant_name}</div>
          <div className="font-mono text-[11px] text-muted-foreground">/{membership.tenant_slug}</div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Rol en el tenant</Label>
          <Select value={role} onValueChange={handleRoleChange} disabled={pending}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLE_OPTIONS.map((r) => (
                <SelectItem key={r} value={r}>
                  {ROLE_LABEL[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full text-destructive hover:text-destructive"
          onClick={handleRemove}
          disabled={pending}
        >
          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
          Quitar de este tenant
        </Button>
      </PopoverContent>
    </Popover>
  )
}

/** "+ Asignar" pill: adds the user to a tenant they are not yet a member of. */
export function AssignTenantPopover({
  userId,
  tenants,
}: {
  userId: string
  tenants: AdminTenant[]
}) {
  const [open, setOpen] = useState(false)
  const [tenantId, setTenantId] = useState<string>(tenants[0]?.id ?? "")
  const [role, setRole] = useState<TenantRoleName>("operator")
  const [pending, start] = useTransition()

  useEffect(() => {
    if (!tenantId || !tenants.find((t) => t.id === tenantId)) {
      setTenantId(tenants[0]?.id ?? "")
    }
  }, [tenants, tenantId])

  function handleSubmit() {
    if (!tenantId) return
    start(async () => {
      const res = await addTenantMembership({ userId, tenantId, role })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success("Tenant asignado")
      setOpen(false)
    })
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-0.5 text-[11px] text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
          title="Asignar tenant"
        >
          <Plus className="h-3 w-3" />
          Asignar
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor={`assign-tenant-${userId}`} className="text-xs">
            Tenant
          </Label>
          <Select value={tenantId} onValueChange={setTenantId}>
            <SelectTrigger id={`assign-tenant-${userId}`}>
              <SelectValue placeholder="Elegí un tenant" />
            </SelectTrigger>
            <SelectContent>
              {tenants.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  /{t.slug} · {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`assign-role-${userId}`} className="text-xs">
            Rol en el tenant
          </Label>
          <Select value={role} onValueChange={(v) => setRole(v as TenantRoleName)}>
            <SelectTrigger id={`assign-role-${userId}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLE_OPTIONS.map((r) => (
                <SelectItem key={r} value={r}>
                  {ROLE_LABEL[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button type="button" size="sm" onClick={handleSubmit} disabled={pending || !tenantId}>
            {pending ? "Asignando..." : "Asignar"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
