"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react"
import { z } from "zod"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { createTenantAction } from "@/app/onboarding/actions"

const BUSINESS_TYPES = [
  { value: "retail", label: "Retail / Minorista", hint: "Vendo al consumidor final" },
  { value: "wholesale", label: "Mayorista / B2B", hint: "Vendo a otros comercios" },
  { value: "manufacturer", label: "Fabricante", hint: "Produzco y distribuyo" },
  { value: "dropshipping", label: "Dropshipping", hint: "Intermedio sin stock propio" },
  { value: "services", label: "Servicios", hint: "Vendo servicios, no productos" },
]

const CURRENCIES = [
  { value: "ARS", label: "ARS — Peso Argentino" },
  { value: "USD", label: "USD — Dólar Estadounidense" },
  { value: "EUR", label: "EUR — Euro" },
  { value: "BRL", label: "BRL — Real Brasileño" },
  { value: "CLP", label: "CLP — Peso Chileno" },
  { value: "MXN", label: "MXN — Peso Mexicano" },
]

const slugSchema = z
  .string()
  .min(3, "Mínimo 3 caracteres")
  .max(40, "Máximo 40 caracteres")
  .regex(/^[a-z0-9-]+$/, "Solo minúsculas, números y guiones")

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 40)
}

type Step = 1 | 2 | 3 | 4

export function OnboardingWizard({ defaultFullName }: { defaultFullName: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [step, setStep] = useState<Step>(1)

  const [fullName, setFullName] = useState(defaultFullName)
  const [tenantName, setTenantName] = useState("")
  const [slug, setSlug] = useState("")
  const [slugTouched, setSlugTouched] = useState(false)
  const [businessType, setBusinessType] = useState<string>("")
  const [currency, setCurrency] = useState("ARS")

  function handleTenantNameChange(value: string) {
    setTenantName(value)
    if (!slugTouched) setSlug(slugify(value))
  }

  function validateStep(s: Step): string | null {
    if (s === 1 && fullName.trim().length < 2) return "Ingresá tu nombre completo"
    if (s === 2) {
      if (tenantName.trim().length < 2) return "Ingresá el nombre de tu empresa"
      const slugCheck = slugSchema.safeParse(slug)
      if (!slugCheck.success) return slugCheck.error.issues[0].message
    }
    if (s === 3 && !businessType) return "Elegí un tipo de negocio"
    return null
  }

  function goNext() {
    const err = validateStep(step)
    if (err) {
      toast.error(err)
      return
    }
    if (step < 4) setStep((step + 1) as Step)
  }

  function goBack() {
    if (step > 1) setStep((step - 1) as Step)
  }

  function handleSubmit() {
    for (const s of [1, 2, 3] as Step[]) {
      const err = validateStep(s)
      if (err) {
        toast.error(err)
        setStep(s)
        return
      }
    }

    startTransition(async () => {
      const result = await createTenantAction({
        fullName,
        name: tenantName,
        slug,
        businessType,
        currency,
      })
      if (!result.ok) {
        toast.error(result.error ?? "No pudimos crear tu espacio")
        return
      }
      toast.success("Espacio creado")
      router.push(`/app/${result.slug}/dashboard`)
    })
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Stepper */}
      <div className="flex items-center gap-2" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={4}>
        {[1, 2, 3, 4].map((s) => (
          <div
            key={s}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              s <= step ? "bg-primary" : "bg-surface-container-high",
            )}
          />
        ))}
      </div>

      <div className="flex items-center justify-between">
        <span className="font-mono text-xs uppercase tracking-wider text-on-surface-variant">
          Paso {step} de 4
        </span>
        <span className="font-mono text-xs uppercase tracking-wider text-primary">
          {step === 1 && "Identidad"}
          {step === 2 && "Tu espacio"}
          {step === 3 && "Negocio"}
          {step === 4 && "Confirmación"}
        </span>
      </div>

      {/* Step content */}
      <div className="min-h-[280px]">
        {step === 1 && (
          <div className="flex flex-col gap-6">
            <div>
              <h2 className="font-display text-3xl font-extrabold tracking-tight text-on-surface">
                ¿Cómo te llamás?
              </h2>
              <p className="mt-2 text-sm text-on-surface-variant">
                Usamos tu nombre para personalizar la experiencia y mostrarlo a tu equipo.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="fullName">Nombre completo</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ada Lovelace"
                autoFocus
                autoComplete="name"
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-6">
            <div>
              <h2 className="font-display text-3xl font-extrabold tracking-tight text-on-surface">
                Creá tu espacio
              </h2>
              <p className="mt-2 text-sm text-on-surface-variant">
                Un espacio agrupa tus productos, integraciones y equipo. Podés crear varios después.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="tenantName">Nombre de la empresa</Label>
              <Input
                id="tenantName"
                value={tenantName}
                onChange={(e) => handleTenantNameChange(e.target.value)}
                placeholder="Acme Indumentaria"
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="slug">Identificador</Label>
              <div className="flex items-center gap-0 rounded border border-outline bg-surface-container-low focus-within:border-primary">
                <span className="px-3 py-2 font-mono text-sm text-on-surface-variant">
                  signalcore.app/
                </span>
                <Input
                  id="slug"
                  value={slug}
                  onChange={(e) => {
                    setSlug(slugify(e.target.value))
                    setSlugTouched(true)
                  }}
                  placeholder="acme-indumentaria"
                  className="border-0 bg-transparent focus-visible:ring-0"
                />
              </div>
              <p className="text-xs text-on-surface-variant">
                Este identificador aparece en la URL. Solo minúsculas, números y guiones.
              </p>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-6">
            <div>
              <h2 className="font-display text-3xl font-extrabold tracking-tight text-on-surface">
                ¿Qué vendés?
              </h2>
              <p className="mt-2 text-sm text-on-surface-variant">
                Esto nos ayuda a sugerir tipos de productos, atributos y reglas por defecto.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              {BUSINESS_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setBusinessType(type.value)}
                  className={cn(
                    "flex items-center justify-between rounded border px-4 py-3 text-left transition-colors",
                    businessType === type.value
                      ? "border-primary bg-primary/5 shadow-signal"
                      : "border-outline bg-surface-container-low hover:border-outline-variant hover:bg-surface-container",
                  )}
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-on-surface">{type.label}</span>
                    <span className="text-xs text-on-surface-variant">{type.hint}</span>
                  </div>
                  {businessType === type.value && <Check className="h-5 w-5 text-primary" />}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="currency">Moneda por defecto</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger id="currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="flex flex-col gap-6">
            <div>
              <h2 className="font-display text-3xl font-extrabold tracking-tight text-on-surface">
                Revisá y confirmá
              </h2>
              <p className="mt-2 text-sm text-on-surface-variant">
                Podés cambiar todo esto más tarde desde la configuración del espacio.
              </p>
            </div>
            <dl className="flex flex-col divide-y divide-outline-variant overflow-hidden rounded border border-outline">
              <SummaryRow label="Tu nombre" value={fullName} />
              <SummaryRow label="Espacio" value={tenantName} />
              <SummaryRow label="URL" value={`signalcore.app/${slug}`} mono />
              <SummaryRow
                label="Negocio"
                value={BUSINESS_TYPES.find((b) => b.value === businessType)?.label ?? ""}
              />
              <SummaryRow label="Moneda" value={currency} mono />
            </dl>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-3 pt-4">
        <Button
          type="button"
          variant="ghost"
          onClick={goBack}
          disabled={step === 1 || isPending}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Atrás
        </Button>

        {step < 4 ? (
          <Button type="button" onClick={goNext} disabled={isPending} className="gap-2">
            Continuar
            <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button type="button" onClick={handleSubmit} disabled={isPending} className="gap-2">
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Crear espacio
          </Button>
        )}
      </div>
    </div>
  )
}

function SummaryRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 bg-surface-container-low px-4 py-3">
      <dt className="text-xs uppercase tracking-wider text-on-surface-variant">{label}</dt>
      <dd className={cn("text-sm font-semibold text-on-surface", mono && "font-mono")}>{value}</dd>
    </div>
  )
}
