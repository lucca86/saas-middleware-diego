"use client"

import { useTransition } from "react"
import { Copy, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { revokeInvitationAction } from "@/app/app/[tenant]/settings/members/actions"

type Invitation = {
  id: string
  email: string
  role: string
  expires_at: string
  accepted_at: string | null
  created_at: string
  token: string
}

function daysUntil(dateStr: string) {
  const diffMs = new Date(dateStr).getTime() - Date.now()
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  return days
}

export function InvitationsList({
  invitations,
  tenantSlug,
}: {
  invitations: Invitation[]
  tenantSlug: string
}) {
  const [isPending, startTransition] = useTransition()

  function buildLink(token: string) {
    if (typeof window === "undefined") return ""
    return `${window.location.origin}/invitations/${token}`
  }

  async function handleCopy(token: string) {
    try {
      await navigator.clipboard.writeText(buildLink(token))
      toast.success("Link copiado al portapapeles")
    } catch {
      toast.error("No pudimos copiar el link")
    }
  }

  function handleRevoke(invitationId: string) {
    startTransition(async () => {
      const result = await revokeInvitationAction({ invitationId, tenantSlug })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success("Invitación revocada")
    })
  }

  if (invitations.length === 0) {
    return (
      <div className="rounded border border-dashed border-outline-variant p-6 text-center text-sm text-on-surface-variant">
        No hay invitaciones pendientes.
      </div>
    )
  }

  return (
    <ul className="overflow-hidden rounded border border-outline divide-y divide-outline-variant">
      {invitations.map((inv) => {
        const days = daysUntil(inv.expires_at)
        return (
          <li
            key={inv.id}
            className="flex items-center justify-between gap-4 bg-surface-container-low px-4 py-3"
          >
            <div className="min-w-0">
              <p className="truncate font-mono text-sm text-on-surface">{inv.email}</p>
              <p className="text-xs text-on-surface-variant">
                Expira en {days} día{days === 1 ? "" : "s"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-wider">
                {inv.role}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleCopy(inv.token)}
                aria-label="Copiar link de invitación"
                className="h-8 w-8"
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleRevoke(inv.id)}
                disabled={isPending}
                aria-label="Revocar invitación"
                className="h-8 w-8 text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
