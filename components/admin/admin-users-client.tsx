"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { Ban, ShieldCheck, ShieldOff, Trash2, UserCheck } from "lucide-react"
import { toast } from "sonner"
import { deleteUser, setUserSuspended, togglePlatformAdmin } from "@/app/admin/actions"
import type { PlatformUser } from "@/lib/platform/queries"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
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
import { CreateUserDialog } from "./create-user-dialog"
import { EditUserDialog } from "./edit-user-dialog"
import { AssignTenantPopover, MembershipChip } from "./membership-controls"
import type { AdminTenant } from "./role-meta"

type StatusFilter = "all" | "active" | "suspended"

export function AdminUsersClient({
  users,
  tenants,
  currentUserId,
}: {
  users: PlatformUser[]
  tenants: AdminTenant[]
  currentUserId: string
}) {
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<StatusFilter>("all")

  const suspendedCount = useMemo(() => users.filter((u) => u.is_suspended).length, [users])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return users.filter((u) => {
      if (status === "active" && u.is_suspended) return false
      if (status === "suspended" && !u.is_suspended) return false
      if (!q) return true
      return (
        (u.email ?? "").toLowerCase().includes(q) ||
        u.memberships.some(
          (m) => m.tenant_slug.toLowerCase().includes(q) || m.tenant_name.toLowerCase().includes(q),
        )
      )
    })
  }, [query, status, users])

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Usuarios</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {users.length} usuario{users.length === 1 ? "" : "s"} en la plataforma
            {suspendedCount > 0 ? `, ${suspendedCount} suspendido${suspendedCount === 1 ? "" : "s"}` : ""}.
            Gestioná accesos, roles por tenant y estado de cada cuenta.
          </p>
        </div>
        <CreateUserDialog tenants={tenants} />
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row">
          <Input
            placeholder="Buscar por email o tenant..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="max-w-sm"
            aria-label="Buscar usuarios"
          />
          <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
            <SelectTrigger className="w-full sm:w-44" aria-label="Filtrar por estado">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="active">Activos</SelectItem>
              <SelectItem value="suspended">Suspendidos</SelectItem>
            </SelectContent>
          </Select>
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
                <TableHead className="w-[170px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((u) => (
                <UserRow key={u.id} user={u} tenants={tenants} isSelf={u.id === currentUserId} />
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

function UserRow({
  user,
  tenants,
  isSelf,
}: {
  user: PlatformUser
  tenants: AdminTenant[]
  isSelf: boolean
}) {
  const [pending, start] = useTransition()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const availableTenants = useMemo(() => {
    const joined = new Set(user.memberships.map((m) => m.tenant_id))
    return tenants.filter((t) => !joined.has(t.id))
  }, [tenants, user.memberships])

  function handleTogglePlatform() {
    start(async () => {
      const res = await togglePlatformAdmin(user.id, !user.is_platform_admin)
      if (!res.ok) toast.error(res.error)
      else toast.success(user.is_platform_admin ? "Removido de plataforma" : "Promovido a plataforma")
    })
  }

  function handleToggleSuspended() {
    start(async () => {
      const res = await setUserSuspended(user.id, !user.is_suspended)
      if (!res.ok) toast.error(res.error)
      else toast.success(user.is_suspended ? "Usuario reactivado" : "Usuario suspendido")
    })
  }

  function handleDelete() {
    start(async () => {
      const res = await deleteUser(user.id)
      if (!res.ok) toast.error(res.error)
      else toast.success("Usuario eliminado")
      setConfirmDelete(false)
    })
  }

  return (
    <TableRow className={user.is_suspended ? "opacity-70" : undefined}>
      <TableCell>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-foreground">{user.email ?? "—"}</span>
          {isSelf ? (
            <Badge variant="outline" className="text-[10px]">
              Vos
            </Badge>
          ) : null}
          {user.is_suspended ? (
            <Badge className="border-destructive/40 bg-destructive/15 text-[10px] text-destructive">
              Suspendido
            </Badge>
          ) : null}
        </div>
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
        <div className="flex flex-wrap items-center gap-1.5">
          {user.memberships.length === 0 ? (
            <span className="text-xs text-muted-foreground">Sin tenants</span>
          ) : (
            user.memberships.map((m) => (
              <MembershipChip key={m.tenant_id} userId={user.id} membership={m} />
            ))
          )}
          {availableTenants.length > 0 ? (
            <AssignTenantPopover userId={user.id} tenants={availableTenants} />
          ) : null}
        </div>
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        <ClientDate iso={user.last_sign_in_at} />
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-0.5">
          <EditUserDialog user={user} disabled={pending} />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={pending || isSelf}
            onClick={handleTogglePlatform}
            title={
              isSelf
                ? "No podés modificar tu propio acceso"
                : user.is_platform_admin
                  ? "Quitar platform admin"
                  : "Promover a platform admin"
            }
          >
            {user.is_platform_admin ? (
              <ShieldOff className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="sr-only">Alternar platform admin</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={pending || (isSelf && !user.is_suspended)}
            onClick={handleToggleSuspended}
            title={
              isSelf
                ? "No podés suspender tu propia cuenta"
                : user.is_suspended
                  ? "Reactivar usuario"
                  : "Suspender usuario"
            }
          >
            {user.is_suspended ? (
              <UserCheck className="h-4 w-4 text-primary" />
            ) : (
              <Ban className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="sr-only">{user.is_suspended ? "Reactivar" : "Suspender"}</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={pending || isSelf}
            onClick={() => setConfirmDelete(true)}
            title={isSelf ? "No podés eliminar tu propia cuenta" : "Eliminar usuario"}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
            <span className="sr-only">Eliminar usuario</span>
          </Button>
        </div>

        <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Eliminar {user.email}</AlertDialogTitle>
              <AlertDialogDescription>
                Se elimina la cuenta y todas sus membresías. Los productos y movimientos que creó se
                conservan sin autor. Si sólo querés bloquear el acceso, suspendé al usuario en su lugar.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                disabled={pending}
                onClick={(e) => {
                  e.preventDefault()
                  handleDelete()
                }}
                className="bg-destructive text-white hover:bg-destructive/90"
              >
                {pending ? "Eliminando..." : "Eliminar definitivamente"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </TableCell>
    </TableRow>
  )
}

/**
 * Renders a date in the user's local timezone. A stable placeholder is
 * rendered on first paint and swapped after mount to avoid hydration mismatches.
 */
function ClientDate({ iso }: { iso: string | null }) {
  const [text, setText] = useState<string>(iso ? "…" : "Nunca")
  useEffect(() => {
    if (!iso) return
    setText(new Date(iso).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" }))
  }, [iso])
  return <span suppressHydrationWarning>{text}</span>
}
