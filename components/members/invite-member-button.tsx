"use client"

import { useState, useTransition } from "react"
import { Loader2, Mail, Plus } from "lucide-react"
import { toast } from "sonner"

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
import { inviteMemberAction } from "@/app/app/[tenant]/settings/members/actions"

export function InviteMemberButton({ tenantId }: { tenantId: string }) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<"admin" | "operator" | "viewer">("viewer")
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const result = await inviteMemberAction({ tenantId, email, role })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success("Invitación creada", {
        description: "Compartí el link con la persona invitada.",
      })
      setEmail("")
      setRole("viewer")
      setOpen(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Invitar miembro
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-extrabold tracking-tight">
            Invitar a tu equipo
          </DialogTitle>
          <DialogDescription>
            Generaremos un link seguro. La invitación expira a los 14 días.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="invite-email">Email</Label>
            <div className="relative">
              <Mail
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant"
                aria-hidden
              />
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="persona@empresa.com"
                required
                className="pl-9"
                autoFocus
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="invite-role">Rol</Label>
            <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
              <SelectTrigger id="invite-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">
                  <div className="flex flex-col">
                    <span className="font-medium">Admin</span>
                    <span className="text-xs text-on-surface-variant">
                      Gestiona equipo, integraciones y configuración
                    </span>
                  </div>
                </SelectItem>
                <SelectItem value="operator">
                  <div className="flex flex-col">
                    <span className="font-medium">Operador</span>
                    <span className="text-xs text-on-surface-variant">
                      Edita productos, stock y precios
                    </span>
                  </div>
                </SelectItem>
                <SelectItem value="viewer">
                  <div className="flex flex-col">
                    <span className="font-medium">Visualizador</span>
                    <span className="text-xs text-on-surface-variant">
                      Solo lectura del catálogo y reportes
                    </span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending} className="gap-2">
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Crear invitación
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
