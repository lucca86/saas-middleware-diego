"use client"

import { useState, useTransition } from "react"
import Image from "next/image"
import Link from "next/link"
import { Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { formatPrice } from "@/lib/storefront/utils"
import { removeLine, updateLineQty } from "@/lib/cart/actions"
import type { CartLine } from "@/lib/cart/cookie"

interface Props {
  tenantSlug: string
  currency: string
  lines: CartLine[]
  count: number
  subtotal: number
}

/**
 * Slide-over cart available from any storefront page. The line list is
 * passed in from the server (read at layout level) so the badge count is
 * always accurate even if the user hits a fresh page. Mutations go through
 * server actions which `revalidatePath` the storefront layout.
 */
export function StorefrontCartSheet({
  tenantSlug,
  currency,
  lines,
  count,
  subtotal,
}: Props) {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label={`Carrito (${count} ${count === 1 ? "ítem" : "ítems"})`}
          className="relative flex h-9 items-center gap-2 rounded-md px-3 font-mono text-[11px] uppercase tracking-[0.18em] text-foreground transition hover:bg-accent"
        >
          <ShoppingBag className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Bag</span>
          {count > 0 ? (
            <span
              aria-hidden="true"
              className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-foreground px-1 text-[10px] font-semibold text-background"
            >
              {count}
            </span>
          ) : null}
        </button>
      </SheetTrigger>

      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
      >
        <SheetHeader className="border-b border-border px-6 py-5">
          <SheetTitle className="font-display text-2xl font-bold tracking-tight">
            Tu bolsa
          </SheetTitle>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            {count} {count === 1 ? "producto" : "productos"}
          </p>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {lines.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
              <ShoppingBag className="h-10 w-10 text-muted-foreground" />
              <p className="font-display text-lg font-semibold">
                Tu bolsa está vacía
              </p>
              <p className="text-sm text-muted-foreground">
                Sumá productos del catálogo para empezar a armar tu pedido.
              </p>
              <Button asChild className="mt-2" onClick={() => setOpen(false)}>
                <Link href={`/s/${tenantSlug}`}>Explorar tienda</Link>
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {lines.map((line) => (
                <CartLineRow
                  key={line.variantId}
                  tenantSlug={tenantSlug}
                  currency={currency}
                  line={line}
                />
              ))}
            </ul>
          )}
        </div>

        {lines.length > 0 ? (
          <div className="border-t border-border bg-card/40 px-6 py-5">
            <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              <span>Subtotal</span>
              <span className="text-foreground">{formatPrice(subtotal, currency)}</span>
            </div>
            <Separator className="my-3" />
            <div className="flex items-baseline justify-between">
              <span className="font-display text-base font-semibold">Total</span>
              <span className="font-mono text-xl font-bold text-foreground">
                {formatPrice(subtotal, currency)}
              </span>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              El envío se coordina con la tienda después del pedido.
            </p>
            <Button
              asChild
              size="lg"
              className="mt-4 w-full"
              onClick={() => setOpen(false)}
            >
              <Link href={`/s/${tenantSlug}/checkout`}>Finalizar pedido</Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="mt-2 w-full"
              onClick={() => setOpen(false)}
            >
              <Link href={`/s/${tenantSlug}/cart`}>Ver carrito completo</Link>
            </Button>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function CartLineRow({
  tenantSlug,
  currency,
  line,
}: {
  tenantSlug: string
  currency: string
  line: CartLine
}) {
  const [pending, startTransition] = useTransition()

  function dec() {
    startTransition(async () => {
      const res = await updateLineQty(tenantSlug, line.variantId, line.qty - 1)
      if (!res.ok) toast.error(res.error)
    })
  }
  function inc() {
    startTransition(async () => {
      const res = await updateLineQty(tenantSlug, line.variantId, line.qty + 1)
      if (!res.ok) toast.error(res.error)
    })
  }
  function remove() {
    startTransition(async () => {
      const res = await removeLine(tenantSlug, line.variantId)
      if (!res.ok) toast.error(res.error)
    })
  }

  const variantLabel = Object.values(line.variantAttrs).filter(Boolean).join(" / ")

  return (
    <li className={cn("flex gap-3 px-6 py-4", pending && "opacity-60")}>
      <Link
        href={`/s/${tenantSlug}/p/${line.productSlug}`}
        className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-md border border-border bg-muted"
      >
        {line.imageUrl ? (
          <Image
            src={line.imageUrl}
            alt={line.productName}
            fill
            sizes="80px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground" />
        )}
      </Link>
      <div className="flex flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/s/${tenantSlug}/p/${line.productSlug}`}
            className="font-display text-sm font-semibold leading-tight text-foreground hover:underline"
          >
            {line.productName}
          </Link>
          <button
            type="button"
            onClick={remove}
            aria-label="Eliminar"
            className="text-muted-foreground transition hover:text-destructive"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {variantLabel ? (
          <p className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            {variantLabel}
          </p>
        ) : null}
        <div className="mt-auto flex items-end justify-between pt-3">
          <div className="flex items-center rounded-md border border-border">
            <button
              type="button"
              onClick={dec}
              disabled={pending || line.qty <= 1}
              aria-label="Disminuir"
              className="flex h-7 w-7 items-center justify-center text-muted-foreground transition hover:text-foreground disabled:opacity-40"
            >
              {line.qty <= 1 ? <Trash2 className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
            </button>
            <span className="min-w-[24px] text-center font-mono text-xs">{line.qty}</span>
            <button
              type="button"
              onClick={inc}
              disabled={pending}
              aria-label="Aumentar"
              className="flex h-7 w-7 items-center justify-center text-muted-foreground transition hover:text-foreground disabled:opacity-40"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
          <span className="font-mono text-sm font-semibold text-foreground">
            {formatPrice(line.unitPrice * line.qty, currency)}
          </span>
        </div>
      </div>
    </li>
  )
}
