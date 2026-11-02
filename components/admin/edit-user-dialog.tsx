"use client"

import { useState, useTransition } from "react"
import { Copy, Pencil, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { updateUserCredentials } from "@/app/admin/actions"
import type { PlatformUser } from "@/lib/platform/queries"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { generatePassword } from "./password"

export function EditUserDialog({ user, disabled }: { user: PlatformUser; disabled?: boolean }) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState(user.email ?? "")
  const [password, setPassword] = useState("")
  const [pending, start] = useTransition()

  const emailChanged = email.trim().toLowerCase() !== (user.email ?? "").toLowerCase()
  const hasChanges = emailChanged || password.length > 0
  const passwordInvalid = password.length > 0 && password.length < 8

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next) {
      setEmail(user.email ?? "")
      setPassword("")
    }
  }

  function handleSubmit() {
    start(async () => {
      const res = await updateUserCredentials({
        userId: user.id,
        email: emailChanged ? email : undefined,
        password: password || undefined,
      })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success("Usuario actualizado", {
        description: password ? `Nueva contraseña: ${password}` : undefined,
        duration: password ? 12000 : 4000,
      })
      setOpen(false)
    })
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={disabled}
        onClick={() => handleOpenChange(true)}
        title="Editar email o contraseña"
      >
        <Pencil className="h-4 w-4 text-muted-foreground" />
        <span className="sr-only">Editar usuario</span>
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar usuario</DialogTitle>
            <DialogDescription>
              Cambiá el email o definí una nueva contraseña. Dejá la contraseña vacía para no modificarla.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor={`edit-email-${user.id}`}>Email</Label>
              <Input
                id={`edit-email-${user.id}`}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="off"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`edit-pass-${user.id}`}>Nueva contraseña</Label>
              <div className="flex gap-2">
                <Input
                  id={`edit-pass-${user.id}`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Sin cambios"
                  className="font-mono text-sm"
                  autoComplete="new-password"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setPassword(generatePassword())}
                  title="Generar contraseña"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={!password}
                  onClick={() => {
                    navigator.clipboard.writeText(password)
                    toast.success("Contraseña copiada")
                  }}
                  title="Copiar"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              {passwordInvalid ? (
                <p className="text-[11px] text-destructive">Mínimo 8 caracteres.</p>
              ) : null}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={pending || !hasChanges || passwordInvalid}>
              {pending ? "Guardando..." : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
