"use client"

import { useState, useTransition } from "react"
import { Copy, Plus, UserPlus } from "lucide-react"
import { toast } from "sonner"
import { createTestUser, type TenantRoleName } from "@/app/admin/actions"
import { Button } from "@/components/ui/button"
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
import { generatePassword } from "./password"
import { ROLE_LABEL, ROLE_OPTIONS, type AdminTenant } from "./role-meta"

const NO_TENANT = "__none__"

export function CreateUserDialog({ tenants }: { tenants: AdminTenant[] }) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState(generatePassword)
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
      setPassword(generatePassword())
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
          <DialogTitle>Crear usuario</DialogTitle>
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
              placeholder="usuario@ejemplo.com"
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
                onClick={() => setPassword(generatePassword())}
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
                  {ROLE_OPTIONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </SelectItem>
                  ))}
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
