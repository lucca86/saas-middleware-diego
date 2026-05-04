"use client"

import { useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { ArrowUpRight, Copy, Eye, EyeOff, Save, Sparkles } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import {
  saveStorefrontConfig,
  setStorefrontPublished,
} from "@/app/app/[tenant]/storefront/actions"
import type { StorefrontConfig } from "@/lib/storefront/types"

interface Props {
  tenantSlug: string
  tenantName: string
  published: boolean
  activeProductCount: number
  config: StorefrontConfig
  readonly: boolean
}

export function StorefrontAdmin({
  tenantSlug,
  tenantName,
  published: initialPublished,
  activeProductCount,
  config,
  readonly,
}: Props) {
  const [published, setPublished] = useState(initialPublished)
  const [form, setForm] = useState<StorefrontConfig>(config)
  const [pending, startTransition] = useTransition()
  const [togglePending, startToggle] = useTransition()

  const [publicUrl, setPublicUrl] = useState(`/s/${tenantSlug}`)
  useEffect(() => {
    setPublicUrl(`${window.location.origin}/s/${tenantSlug}`)
  }, [tenantSlug])

  function update<K extends keyof StorefrontConfig>(key: K, value: StorefrontConfig[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleSave() {
    startTransition(async () => {
      const res = await saveStorefrontConfig(tenantSlug, form)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success("Configuración guardada")
    })
  }

  function handleTogglePublish(next: boolean) {
    if (next && activeProductCount === 0) {
      toast.error("Necesitás al menos un producto activo antes de publicar.")
      return
    }
    startToggle(async () => {
      const res = await setStorefrontPublished(tenantSlug, next)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      setPublished(next)
      toast.success(next ? "Storefront publicado" : "Storefront despublicado")
    })
  }

  function copyLink() {
    navigator.clipboard.writeText(publicUrl)
    toast.success("Link copiado")
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Tienda
        </p>
        <h1 className="mt-2 font-display text-3xl font-extrabold leading-tight text-foreground">
          Storefront público
        </h1>
        <p className="mt-2 max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground">
          La cara pública de tu catálogo. Sin checkout — los visitantes te contactan por WhatsApp con
          el producto pre-cargado. Activalo cuando tengas al menos un producto en estado &ldquo;Activo&rdquo;.
        </p>
      </header>

      {/* Publish card */}
      <section className="rounded-lg border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-md bg-accent/30 p-2 text-accent-foreground">
              {published ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-lg font-bold text-foreground">
                  {published ? "Publicado" : "No publicado"}
                </h2>
                <Badge
                  variant={published ? "default" : "outline"}
                  className={published ? "border-success/30 bg-success/15 text-success" : ""}
                >
                  {published ? "live" : "borrador"}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {published
                  ? "Cualquier persona con el link puede ver tu catálogo."
                  : "Solo vos podés ver tu catálogo. Cuando publiques, será accesible públicamente."}
              </p>
            </div>
          </div>
          <Switch
            checked={published}
            disabled={readonly || togglePending}
            onCheckedChange={handleTogglePublish}
            aria-label="Publicar storefront"
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-md border border-dashed border-border bg-background/50 p-3">
          <code className="flex-1 truncate font-mono text-xs text-muted-foreground">
            {publicUrl}
          </code>
          <Button type="button" variant="outline" size="sm" onClick={copyLink}>
            <Copy className="mr-1.5 h-3.5 w-3.5" />
            Copiar
          </Button>
          <Button asChild type="button" variant="outline" size="sm">
            <Link href={`/s/${tenantSlug}`} target="_blank">
              Abrir
              <ArrowUpRight className="ml-1.5 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>

        {activeProductCount === 0 ? (
          <p className="mt-3 flex items-center gap-2 text-xs text-warning">
            <Sparkles className="h-3.5 w-3.5" />
            Sin productos activos: agregá al menos uno con estado &ldquo;Activo&rdquo; para publicar.
          </p>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">
            {activeProductCount} producto{activeProductCount === 1 ? "" : "s"} activo
            {activeProductCount === 1 ? "" : "s"} se mostrará{activeProductCount === 1 ? "" : "n"}.
          </p>
        )}
      </section>

      {/* Config form */}
      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="font-display text-lg font-bold text-foreground">Personalización</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Cómo se ve y comunica tu tienda con tus clientes.
        </p>

        <FieldGroup className="mt-5">
          <Field>
            <FieldLabel>Título principal</FieldLabel>
            <Input
              maxLength={120}
              value={form.hero_title ?? ""}
              placeholder={tenantName}
              onChange={(e) => update("hero_title", e.target.value)}
              disabled={readonly}
            />
          </Field>

          <Field>
            <FieldLabel>Subtítulo</FieldLabel>
            <Input
              maxLength={240}
              value={form.hero_subtitle ?? ""}
              placeholder="Una frase corta que describa tu marca"
              onChange={(e) => update("hero_subtitle", e.target.value)}
              disabled={readonly}
            />
          </Field>

          <Field>
            <FieldLabel>Sobre nosotros</FieldLabel>
            <Textarea
              maxLength={1200}
              rows={4}
              value={form.about ?? ""}
              placeholder="Quiénes son, qué venden, dónde están. Aparece debajo del catálogo."
              onChange={(e) => update("about", e.target.value)}
              disabled={readonly}
            />
            <p className="mt-1 font-mono text-[10px] text-muted-foreground">
              {(form.about?.length ?? 0)}/1200
            </p>
          </Field>
        </FieldGroup>

        <div className="my-6 h-px bg-border" />
        <h3 className="font-display text-sm font-bold uppercase tracking-[0.18em] text-muted-foreground">
          Contacto
        </h3>

        <FieldGroup className="mt-3">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field>
              <FieldLabel>WhatsApp</FieldLabel>
              <Input
                placeholder="+54 9 11 5555 7777"
                value={form.whatsapp ?? ""}
                onChange={(e) => update("whatsapp", e.target.value)}
                disabled={readonly}
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Incluí el código de país. Va al botón &ldquo;Consultar&rdquo; de cada producto.
              </p>
            </Field>

            <Field>
              <FieldLabel>Instagram</FieldLabel>
              <Input
                placeholder="tu_marca"
                value={form.instagram ?? ""}
                onChange={(e) => update("instagram", e.target.value)}
                disabled={readonly}
              />
              <p className="mt-1 text-[11px] text-muted-foreground">Sin el @</p>
            </Field>

            <Field>
              <FieldLabel>Email</FieldLabel>
              <Input
                type="email"
                placeholder="hola@tumarca.com"
                value={form.email ?? ""}
                onChange={(e) => update("email", e.target.value)}
                disabled={readonly}
              />
            </Field>

            <Field>
              <FieldLabel>Color de acento</FieldLabel>
              <div className="flex items-center gap-2">
                <Input
                  type="color"
                  className="h-10 w-14 cursor-pointer p-1"
                  value={form.accent && /^#/.test(form.accent) ? form.accent : "#0891b2"}
                  onChange={(e) => update("accent", e.target.value)}
                  disabled={readonly}
                />
                <Input
                  placeholder="#0891b2"
                  value={form.accent ?? ""}
                  onChange={(e) => update("accent", e.target.value)}
                  disabled={readonly}
                />
              </div>
            </Field>
          </div>

          <Field>
            <FieldLabel>Mensaje de WhatsApp</FieldLabel>
            <Textarea
              maxLength={400}
              rows={3}
              placeholder="Hola! Me interesa {product}. {url}"
              value={form.whatsapp_template ?? ""}
              onChange={(e) => update("whatsapp_template", e.target.value)}
              disabled={readonly}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Soporta <code className="font-mono">{"{product}"}</code> y{" "}
              <code className="font-mono">{"{url}"}</code> como variables. Si lo dejás vacío usamos un
              template por defecto.
            </p>
          </Field>
        </FieldGroup>

        <div className="my-6 h-px bg-border" />
        <h3 className="font-display text-sm font-bold uppercase tracking-[0.18em] text-muted-foreground">
          Notificaciones por email
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Para enviar emails transaccionales (pedidos recibidos, confirmados, entregados o
          cancelados) configurá un remitente verificado en{" "}
          <a
            href="https://resend.com/domains"
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground underline-offset-2 hover:underline"
          >
            Resend → Domains
          </a>
          . Si dejás el remitente vacío, no se envían emails al cliente.
        </p>

        <FieldGroup className="mt-4">
          <Field>
            <FieldLabel>Remitente (from)</FieldLabel>
            <Input
              placeholder='Tu marca <pedidos@tu-dominio.com>'
              value={form.from_email ?? ""}
              onChange={(e) => update("from_email", e.target.value)}
              disabled={readonly}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Aceptamos <code className="font-mono">email@dominio</code> o{" "}
              <code className="font-mono">Nombre &lt;email@dominio&gt;</code>. El dominio debe estar
              verificado en Resend.
            </p>
          </Field>

          <Field>
            <FieldLabel>Avisos de pedidos nuevos (interno)</FieldLabel>
            <Input
              type="email"
              placeholder="pedidos@tu-marca.com"
              value={form.notification_email ?? ""}
              onChange={(e) => update("notification_email", e.target.value)}
              disabled={readonly}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Te enviamos un mail acá cuando alguien hace un pedido en tu storefront. Opcional.
            </p>
          </Field>
        </FieldGroup>

        <div className="my-6 h-px bg-border" />
        <h3 className="font-display text-sm font-bold uppercase tracking-[0.18em] text-muted-foreground">
          Comportamiento
        </h3>

        <div className="mt-3 space-y-3">
          <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 hover:bg-accent/30">
            <Switch
              checked={form.hide_out_of_stock ?? false}
              onCheckedChange={(v) => update("hide_out_of_stock", v)}
              disabled={readonly}
            />
            <div>
              <div className="text-sm font-medium text-foreground">Ocultar productos sin stock</div>
              <div className="text-xs text-muted-foreground">
                Los visitantes no ven productos cuando todas las variantes están en 0.
              </div>
            </div>
          </label>

          <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 hover:bg-accent/30">
            <Switch
              checked={form.hide_prices ?? false}
              onCheckedChange={(v) => update("hide_prices", v)}
              disabled={readonly}
            />
            <div>
              <div className="text-sm font-medium text-foreground">Ocultar precios</div>
              <div className="text-xs text-muted-foreground">
                Útil si trabajás solo mayorista o por consulta.
              </div>
            </div>
          </label>
        </div>

        <div className="mt-6 flex justify-end">
          <Button onClick={handleSave} disabled={readonly || pending}>
            <Save className="mr-1.5 h-4 w-4" />
            {pending ? "Guardando…" : "Guardar cambios"}
          </Button>
        </div>
      </section>
    </div>
  )
}
