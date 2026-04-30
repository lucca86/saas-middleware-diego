"use client"

import { useTransition } from "react"
import { ShoppingBag } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { addToCart } from "@/lib/cart/actions"

interface Props {
  tenantSlug: string
  variantId: string | null
  disabled?: boolean
  label?: string
}

export function StorefrontAddToCart({
  tenantSlug,
  variantId,
  disabled,
  label = "Agregar al carrito",
}: Props) {
  const [pending, startTransition] = useTransition()

  function add() {
    if (!variantId) return
    startTransition(async () => {
      const res = await addToCart(tenantSlug, variantId, 1)
      if (!res.ok) {
        toast.error(res.error)
      } else {
        toast.success("Agregado al carrito", {
          description: `${res.count} ${res.count === 1 ? "producto" : "productos"} en tu bolsa`,
        })
      }
    })
  }

  return (
    <Button
      type="button"
      size="lg"
      className="w-full"
      onClick={add}
      disabled={disabled || pending || !variantId}
    >
      {pending ? <Spinner className="mr-2 h-4 w-4" /> : <ShoppingBag className="mr-2 h-4 w-4" />}
      {label}
    </Button>
  )
}
