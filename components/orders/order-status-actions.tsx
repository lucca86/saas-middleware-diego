"use client"

import { useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { updateOrderStatus } from "@/lib/orders/admin-actions"
import type { OrderStatus } from "@/lib/orders/types"

interface Props {
  tenantSlug: string
  orderId: string
  status: OrderStatus
}

const NEXT_TRANSITIONS: Record<
  OrderStatus,
  Array<{ status: OrderStatus; label: string; variant?: "default" | "outline" | "destructive" }>
> = {
  pending: [
    { status: "confirmed", label: "Confirmar pedido", variant: "default" },
    { status: "cancelled", label: "Cancelar", variant: "outline" },
  ],
  confirmed: [
    { status: "fulfilled", label: "Marcar entregado", variant: "default" },
    { status: "cancelled", label: "Cancelar", variant: "outline" },
  ],
  fulfilled: [],
  cancelled: [],
}

export function OrderStatusActions({ tenantSlug, orderId, status }: Props) {
  const [pending, startTransition] = useTransition()
  const transitions = NEXT_TRANSITIONS[status] ?? []

  if (transitions.length === 0) {
    return (
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        Sin acciones disponibles
      </p>
    )
  }

  function trigger(next: OrderStatus, label: string) {
    startTransition(async () => {
      const res = await updateOrderStatus(tenantSlug, orderId, next)
      if (!res.ok) toast.error(res.error)
      else toast.success(`Estado actualizado: ${label}`)
    })
  }

  return (
    <div className="flex flex-col gap-2">
      {transitions.map((t) => (
        <Button
          key={t.status}
          variant={t.variant ?? "default"}
          size="sm"
          disabled={pending}
          onClick={() => trigger(t.status, t.label)}
        >
          {pending ? <Spinner className="mr-2 h-3.5 w-3.5" /> : null}
          {t.label}
        </Button>
      ))}
    </div>
  )
}
