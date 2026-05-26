"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ExternalLink, Eye, EyeOff, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { connectMercadoLibre } from "@/app/app/[tenant]/channels/actions"

/**
 * Connection form for MercadoLibre.
 *
 * ML requires a Partner App (App ID + Client Secret) to perform OAuth.
 * Instead of forcing admins to set env vars, each tenant configures their
 * own ML developer app credentials here. The form validates the credentials
 * and then redirects to ML's OAuth authorization page.
 *
 * How to get credentials:
 *   https://developers.mercadolibre.com.ar/devcenter
 */
export function MercadoLibreConnectForm({ tenantSlug }: { tenantSlug: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [appId, setAppId] = useState("")
  const [clientSecret, setClientSecret] = useState("")
  const [showSecret, setShowSecret] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!appId.trim() || !clientSecret.trim()) {
      toast.error("Completá los dos campos.")
      return
    }
    start(async () => {
      const res = await connectMercadoLibre(tenantSlug, {
        appId: appId.trim(),
        clientSecret: clientSecret.trim(),
        appUrl: window.location.origin,
      })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      // res.redirectUrl is the ML OAuth URL — navigate there
      router.push(res.redirectUrl)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FieldGroup>
        <Field>
          <FieldLabel>App ID</FieldLabel>
          <Input
            type="text"
            placeholder="1234567890"
            value={appId}
            onChange={(e) => setAppId(e.target.value)}
            disabled={pending}
            autoComplete="off"
            spellCheck={false}
            className="font-mono text-xs"
            required
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            Número de tu app en el DevCenter de ML (ej: <span className="font-mono">1234567890</span>).
          </p>
        </Field>

        <Field>
          <FieldLabel>Client Secret</FieldLabel>
          <div className="flex gap-2">
            <Input
              type={showSecret ? "text" : "password"}
              placeholder="xxxxxxxxxxxxxxxxxxxx"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
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
              aria-label={showSecret ? "Ocultar secret" : "Mostrar secret"}
            >
              {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </Field>
      </FieldGroup>

      <div className="rounded-md border border-border bg-muted/30 p-3 text-xs">
        <p className="font-medium text-foreground">¿Cómo obtengo el App ID y el Client Secret?</p>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-muted-foreground">
          <li>
            Entrá a{" "}
            <a
              href="https://developers.mercadolibre.com.ar/devcenter"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary underline underline-offset-2"
            >
              developers.mercadolibre.com.ar/devcenter
              <ExternalLink className="h-2.5 w-2.5" />
            </a>{" "}
            con tu cuenta de ML.
          </li>
          <li>
            Hacé clic en <strong className="text-foreground">Crear aplicación</strong>.
          </li>
          <li>
            En <strong className="text-foreground">URL de redireccionamiento</strong> poné:{" "}
            <span className="break-all font-mono text-[10px]">
              {typeof window !== "undefined"
                ? `${window.location.origin}/api/mercadolibre/callback`
                : "/api/mercadolibre/callback"}
            </span>
          </li>
          <li>
            Activá los scopes: <span className="font-mono">offline_access</span>,{" "}
            <span className="font-mono">read</span> y <span className="font-mono">write</span>.
          </li>
          <li>Guardá la app y copiá el <strong className="text-foreground">App ID</strong> y el <strong className="text-foreground">Secret key</strong>.</li>
        </ol>
      </div>

      <Button type="submit" className="w-full" disabled={pending}>
        <Lock className="mr-1.5 h-4 w-4" />
        {pending ? "Verificando…" : "Continuar con MercadoLibre"}
      </Button>
    </form>
  )
}
