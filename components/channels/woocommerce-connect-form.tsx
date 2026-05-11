"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { connectWooCommerce } from "@/app/app/[tenant]/channels/actions"

/**
 * Connection form for WooCommerce. Unlike OAuth providers (Tienda Nube),
 * WooCommerce REST API uses Basic Auth with a Consumer Key + Secret pair
 * that the store owner generates manually in their WP admin. We present a
 * three-field form and validate the keys server-side by probing the
 * `system_status` endpoint before saving.
 */
export function WooCommerceConnectForm({ tenantSlug }: { tenantSlug: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [storeUrl, setStoreUrl] = useState("")
  const [consumerKey, setConsumerKey] = useState("")
  const [consumerSecret, setConsumerSecret] = useState("")
  const [showSecret, setShowSecret] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!storeUrl || !consumerKey || !consumerSecret) {
      toast.error("Completá los tres campos.")
      return
    }
    start(async () => {
      const res = await connectWooCommerce(tenantSlug, {
        storeUrl,
        consumerKey,
        consumerSecret,
      })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success("WooCommerce conectado")
      router.push(`/app/${tenantSlug}/channels/${res.channelId}?connected=1`)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FieldGroup>
        <Field>
          <FieldLabel>URL de la tienda</FieldLabel>
          <Input
            type="url"
            placeholder="https://mitienda.com"
            value={storeUrl}
            onChange={(e) => setStoreUrl(e.target.value)}
            disabled={pending}
            autoComplete="off"
            required
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            Dominio raíz de tu WordPress. Sin <code className="font-mono">/wp-admin</code> ni{" "}
            <code className="font-mono">/wp-json</code>.
          </p>
        </Field>

        <Field>
          <FieldLabel>Consumer Key</FieldLabel>
          <Input
            type="text"
            placeholder="ck_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            value={consumerKey}
            onChange={(e) => setConsumerKey(e.target.value)}
            disabled={pending}
            autoComplete="off"
            spellCheck={false}
            className="font-mono text-xs"
            required
          />
        </Field>

        <Field>
          <FieldLabel>Consumer Secret</FieldLabel>
          <div className="flex gap-2">
            <Input
              type={showSecret ? "text" : "password"}
              placeholder="cs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              value={consumerSecret}
              onChange={(e) => setConsumerSecret(e.target.value)}
              disabled={pending}
              autoComplete="off"
              spellCheck={false}
              className="font-mono text-xs"
              required
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowSecret((v) => !v)}
              disabled={pending}
            >
              {showSecret ? "Ocultar" : "Ver"}
            </Button>
          </div>
        </Field>
      </FieldGroup>

      <div className="rounded-md border border-border bg-muted/30 p-3 text-xs">
        <p className="font-medium text-foreground">¿Cómo obtengo las claves?</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
          <li>
            Iniciá sesión en el admin de tu WordPress y andá a{" "}
            <span className="font-mono">WooCommerce → Ajustes → Avanzado → API REST</span>.
          </li>
          <li>Hacé clic en &ldquo;Añadir clave&rdquo;.</li>
          <li>
            Descripción libre (ej: <em>Stockcurve</em>), usuario admin, permisos{" "}
            <strong>Lectura/Escritura</strong>.
          </li>
          <li>Generá la clave y copiá ambos valores acá antes de cerrar la pantalla.</li>
        </ol>
      </div>

      <Button type="submit" className="w-full" disabled={pending}>
        <Lock className="mr-1.5 h-4 w-4" />
        {pending ? "Verificando…" : "Conectar con WooCommerce"}
      </Button>
    </form>
  )
}
