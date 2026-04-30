"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel, FieldDescription } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Spinner } from "@/components/ui/spinner"
import { placeOrder } from "@/lib/orders/place-order"

interface Props {
  tenantSlug: string
}

export function StorefrontCheckoutForm({ tenantSlug }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string>>({})

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const input = {
      customer_name: String(fd.get("customer_name") ?? "").trim(),
      customer_email: String(fd.get("customer_email") ?? "").trim(),
      customer_phone: String(fd.get("customer_phone") ?? "").trim(),
      shipping_notes: String(fd.get("shipping_notes") ?? "").trim(),
    }

    const next: Record<string, string> = {}
    if (input.customer_name.length < 2) next.customer_name = "Ingresá tu nombre"
    if (!/^.+@.+\..+$/.test(input.customer_email))
      next.customer_email = "Email inválido"
    setErrors(next)
    if (Object.keys(next).length > 0) return

    startTransition(async () => {
      const res = await placeOrder(tenantSlug, input)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      router.push(`/s/${tenantSlug}/orders/${res.orderCode}`)
    })
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8" noValidate>
      <section>
        <h2 className="font-display text-lg font-semibold tracking-tight">
          Tus datos
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          La tienda te va a contactar a este email para confirmar el pedido.
        </p>
        <FieldGroup className="mt-5">
          <Field data-invalid={!!errors.customer_name}>
            <FieldLabel htmlFor="customer_name">Nombre y apellido</FieldLabel>
            <Input
              id="customer_name"
              name="customer_name"
              autoComplete="name"
              required
              maxLength={120}
              aria-invalid={!!errors.customer_name}
            />
            {errors.customer_name ? (
              <FieldDescription className="text-destructive">
                {errors.customer_name}
              </FieldDescription>
            ) : null}
          </Field>

          <Field data-invalid={!!errors.customer_email}>
            <FieldLabel htmlFor="customer_email">Email</FieldLabel>
            <Input
              id="customer_email"
              name="customer_email"
              type="email"
              autoComplete="email"
              required
              maxLength={160}
              aria-invalid={!!errors.customer_email}
            />
            {errors.customer_email ? (
              <FieldDescription className="text-destructive">
                {errors.customer_email}
              </FieldDescription>
            ) : null}
          </Field>

          <Field>
            <FieldLabel htmlFor="customer_phone">
              Teléfono / WhatsApp <span className="text-muted-foreground">(opcional)</span>
            </FieldLabel>
            <Input
              id="customer_phone"
              name="customer_phone"
              type="tel"
              autoComplete="tel"
              maxLength={40}
              placeholder="+54 9 11 0000 0000"
            />
          </Field>
        </FieldGroup>
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold tracking-tight">
          Notas para la tienda
        </h2>
        <FieldGroup className="mt-5">
          <Field>
            <FieldLabel htmlFor="shipping_notes">
              Dirección, horario, comentarios <span className="text-muted-foreground">(opcional)</span>
            </FieldLabel>
            <Textarea
              id="shipping_notes"
              name="shipping_notes"
              rows={4}
              maxLength={800}
              placeholder="Ejemplo: 'Calle Falsa 123, retiro en local los sábados'."
            />
            <FieldDescription>
              Si necesitás envío, indicalo acá. La tienda coordina el costo y el medio de pago.
            </FieldDescription>
          </Field>
        </FieldGroup>
      </section>

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? <Spinner className="mr-2 h-4 w-4" /> : null}
        Confirmar pedido
      </Button>
      <p className="text-center text-[11px] text-muted-foreground">
        Al confirmar, registramos tu pedido y se lo enviamos a la tienda. No se cobra nada en este paso.
      </p>
    </form>
  )
}

// Re-export for the page that imports `CheckoutForm`.
export { StorefrontCheckoutForm as CheckoutForm }
