"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { Check, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"

export function AcceptInvitationButton({ token }: { token: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleAccept() {
    startTransition(async () => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc("accept_invitation", { _token: token })

      if (error) {
        toast.error("No pudimos aceptar la invitación")
        console.log("[sc] accept_invitation error:", error)
        return
      }

      const result = data as { ok: boolean; error?: string; slug?: string }
      if (!result.ok) {
        const messages: Record<string, string> = {
          not_authenticated: "Tenés que iniciar sesión primero",
          invitation_not_found: "Invitación no encontrada",
          already_accepted: "La invitación ya fue aceptada",
          expired: "La invitación expiró",
          email_mismatch: "El email no coincide con la invitación",
        }
        toast.error(messages[result.error ?? ""] ?? "No pudimos aceptar la invitación")
        return
      }

      toast.success("Bienvenida/o al espacio")
      router.push(`/app/${result.slug}/dashboard`)
      router.refresh()
    })
  }

  return (
    <Button onClick={handleAccept} disabled={isPending} className="w-full gap-2">
      {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
      Aceptar invitación
    </Button>
  )
}
