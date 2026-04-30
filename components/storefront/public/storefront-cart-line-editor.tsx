"use client"

import { useTransition } from "react"
import { Minus, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { removeLine, updateLineQty } from "@/lib/cart/actions"

interface Props {
  tenantSlug: string
  variantId: string
  qty: number
}

/**
 * Inline qty stepper used on the full-page cart. The drawer uses its own
 * compact variant; this one is wider for desktop reading order.
 */
export function CartLineEditor({ tenantSlug, variantId, qty }: Props) {
  const [pending, startTransition] = useTransition()

  function dec() {
    startTransition(async () => {
      const res = await updateLineQty(tenantSlug, variantId, qty - 1)
      if (!res.ok) toast.error(res.error)
    })
  }
  function inc() {
    startTransition(async () => {
      const res = await updateLineQty(tenantSlug, variantId, qty + 1)
      if (!res.ok) toast.error(res.error)
    })
  }
  function remove() {
    startTransition(async () => {
      const res = await removeLine(tenantSlug, variantId)
      if (!res.ok) toast.error(res.error)
    })
  }

  return (
    <div className={cn("flex items-center gap-4", pending && "opacity-60")}>
      <div className="flex items-center rounded-md border border-border">
        <button
          type="button"
          onClick={dec}
          disabled={pending || qty <= 1}
          aria-label="Disminuir"
          className="flex h-9 w-9 items-center justify-center text-muted-foreground transition hover:text-foreground disabled:opacity-40"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <span className="min-w-[36px] text-center font-mono text-sm">{qty}</span>
        <button
          type="button"
          onClick={inc}
          disabled={pending}
          aria-label="Aumentar"
          className="flex h-9 w-9 items-center justify-center text-muted-foreground transition hover:text-foreground disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      <button
        type="button"
        onClick={remove}
        disabled={pending}
        className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground transition hover:text-destructive disabled:opacity-40"
      >
        <Trash2 className="h-3 w-3" />
        Quitar
      </button>
    </div>
  )
}
