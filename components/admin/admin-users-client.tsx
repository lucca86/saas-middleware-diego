"use client"

import { useMemo, useState, useTransition } from "react"
import { Copy, Plus, ShieldCheck, ShieldOff, Trash2, UserPlus } from "lucide-react"
import { toast } from "sonner"
import {
  createTestUser,
  deleteUser,
  removeTenantMembership,
  togglePlatformAdmin,
  type TenantRoleName,
} from "@/app/admin/actions"
import type { PlatformUser } from "@/lib/platform/queries"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const ROLE_LABEL: Record<TenantRoleName, string> = {
  owner: "Owner",
  admin: "Admin (tenant)",
  operator: "Operator",
  viewer: "Viewer",
}

const ROLE_VARIANT: Record<TenantRoleName, string> = {
  owner: "border-primary/40 bg-primary/15 text-primary",
  admin: "border-primary/30 bg-primary/10 text-primary",
  operator: "border-secondary/40 bg-secondary text-secondary-foreground",
  viewer: "border-border bg-muted text-muted-foreground",
}

type Tenant = { id: string; slug: string; name: string }

export function AdminUsersClient({
  users,
  tenants,
}: {
  users: PlatformUser[]
  tenants: Tenant[]
}) {
  const [query, setQuery] = useState("")
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return users
    return users.filter(
      (u) =>
        (u.email ?? "").toLowerCase().includes(q) ||
        u.memberships.some(
          (m) => m.tenant_slug.toLowerCase().includes(q) || m.tenant_name.toLowerCase().includes(q),
        ),
    )
  }, [query, users])

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Usuarios</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {users.length} usuario{users.length === 1 ? "" : "s"} en la plataforma. Creá usuarios de
            prueba con cualquier rol para validar el comportamiento del sistema.
          </p>
        </div>
        <CreateTestUserDialog tenants={tenants} />
      </div>

      <Card>
        <CardContent className="p-4">
          <Input
            placeholder="Buscar por email o tenant..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="max-w-sm"
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Plataforma</TableHead>
                <TableHead>Tenants</TableHead>
                <TableHead>Último ingreso</TableHead>
                <TableHead className="w-[120px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((u) => (
                <UserRow key={u.id} user={u} />
              ))}
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                    Sin resultados.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function UserRow({ user }: { user: PlatformUser }) {
  const [pending, start] = useTransition()

  function handleTogglePlatform() {
    start(async () => {
      const res = await togglePlatformAdmin(user.id, !user.is_platform_admin)
      if (!res.ok) toast.error(res.error)
      else toast.success(user.is_platform_admin ? "Removido de plataforma" : "Promovido a plataforma")
    })
  }
  function handleRemoveMembership(tenantId: string) {
    start(async () => {
      const res = await removeTenantMembership(user.id, tenantId)
      if (!res.ok) toast.error(res.error)
      else toast.success("Membresía removida")
    })
  }
  function handleDelete() {
    if (!confirm(`Eliminar el usuario ${user.email}? Esta acción no se puede deshacer.`)) return
    start(async () => {
      const res = await deleteUser(user.id)
      if (!res.ok) toast.error(res.error)
      else toast.success("Usuario eliminado")
    })
  }

  return (
    <TableRow>
      <TableCell>
        <div className="font-medium text-foreground">{user.email ?? "—"}</div>
        <div className="font-mono text-[10px] text-muted-foreground">{user.id.slice(0, 8)}…</div>
      </TableCell>
      <TableCell>
        {user.is_platform_admin ? (
          <Badge className="border-primary/40 bg-primary/15 text-primary">
            <ShieldCheck className="mr-1 h-3 w-3" /> Platform admin
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        {user.memberships.length === 0 ? (
          <span className="text-xs text-muted-foreground">Sin tenants</span>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {user.memberships.map((m) => {
              const role = m.role as TenantRoleName
              return (
                <li key={`${m.tenant_id}-${m.role}`}>
                  <button
                    type="button"
                    onClick={() => handleRemoveMembership(m.tenant_id)}
                    disabled={pending}
                    className={`group inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${
                      ROLE_VARIANT[role] ?? ROLE_VARIANT.viewer
                    }`}
                    title="Click para remover"
                  >
                    <span className="font-mono">/{m.tenant_slug}</span>
                    <span className="opacity-70">· {ROLE_LABEL[role] ?? m.role}</span>
                    <Trash2 className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {user.last_sign_in_at
          ? new Date(user.last_sign_in_at).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })
          : "Nunca"}
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={pending}
            onClick={handleTogglePlatform}
            title={user.is_platform_admin ? "Quitar platform admin" : "Promover a platform admin"}
          >
            {user.is_platform_admin ? (
              <ShieldOff className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={pending}
            onClick={handleDelete}
            title="Eliminar usuario"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}

function randomPassword() {
  return (
    "Test" +
    Math.random().toString(36).slice(2, 8) +
    "!" +
    Math.floor(Math.random() * 90 + 10)
  )
}

function CreateTestUserDialog({ tenants }: { tenants: Tenant[] }) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState(randomPassword)
  const NO_TENANT = "__none__"
  const [tenantId, setTenantId] = useState<string>(tenants[0]?.id ?? NO_TENANT)
  const [role, setRole] = useState<TenantRoleName>("operator")
  const [promoteToPlatformAdmin, setPromoteToPlatformAdmin] = useState(false)
  const [pending, start] = useTransition()

  function handleSubmit() {
    start(async () => {
      const realTenant = tenantId && tenantId !== NO_TENANT ? tenantId : undefined
      const res = await createTestUser({
        email,
        password,
        tenantId: realTenant,
        role: realTenant ? role : undefined,
        promoteToPlatformAdmin,
      })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(`Usuario ${res.email} creado`, {
        description: `Contraseña: ${password}`,
        duration: 12000,
      })
      setOpen(false)
      setEmail("")
      setPassword(randomPassword())
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="mr-1.5 h-4 w-4" />
          Nuevo usuario
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Crear usuario de prueba</DialogTitle>
          <DialogDescription>
            El usuario se crea verificado y puede entrar inmediatamente. Asigná un tenant y rol para
            simular su experiencia.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="u-email">Email</Label>
            <Input
              id="u-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="prueba@ejemplo.com"
              autoComplete="off"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="u-pass">Contraseña</Label>
            <div className="flex gap-2">
              <Input
                id="u-pass"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="font-mono text-sm"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => {
                  navigator.clipboard.writeText(password)
                  toast.success("Contraseña copiada")
                }}
                title="Copiar"
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setPassword(randomPassword())}
                title="Generar otra"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Mínimo 8 caracteres. Anotala antes de crear el usuario.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tenant</Label>
              <Select value={tenantId} onValueChange={setTenantId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sin tenant" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_TENANT}>Sin tenant</SelectItem>
                  {tenants.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Rol en tenant</Label>
              <Select
                value={role}
                onValueChange={(v) => setRole(v as TenantRoleName)}
                disabled={!tenantId || tenantId === NO_TENANT}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">Owner</SelectItem>
                  <SelectItem value="admin">Admin (tenant)</SelectItem>
                  <SelectItem value="operator">Operator</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <label className="flex items-start gap-2 rounded-md border border-border bg-muted/30 p-3 text-sm">
            <input
              type="checkbox"
              checked={promoteToPlatformAdmin}
              onChange={(e) => setPromoteToPlatformAdmin(e.target.checked)}
              className="mt-0.5"
            />
            <div>
              <div className="font-medium text-foreground">Promover a Platform admin</div>
              <div className="text-xs text-muted-foreground">
                Acceso completo a /admin (sólo recomendado para usuarios de la plataforma).
              </div>
            </div>
          </label>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={pending || !email || password.length < 8}>
            {pending ? "Creando..." : "Crear usuario"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
