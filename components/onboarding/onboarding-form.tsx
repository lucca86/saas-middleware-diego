"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createTenantAction } from "@/app/onboarding/actions"
import { toast } from "sonner"

function slugify(str: string) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 40)
}

export function OnboardingForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [slugTouched, setSlugTouched] = useState(false)
  const [businessType, setBusinessType] = useState("retail")
  const [currency, setCurrency] = useState("ARS")

  function onNameChange(v: string) {
    setName(v)
    if (!slugTouched) setSlug(slugify(v))
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    startTransition(async () => {
      const result = await createTenantAction({
        name: name.trim(),
        slug: slug.trim(),
        businessType,
        currency,
      })

      if (!result.ok) {
        toast.error("No pudimos crear el espacio", { description: result.error })
        return
      }

      router.push(`/app/${result.slug}/dashboard`)
      router.refresh()
    })
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="name" className="font-sans text-xs uppercase tracking-[0.12em]">
          Nombre del comercio
        </Label>
        <Input
          id="name"
          required
          minLength={2}
          maxLength={60}
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="Mi Tienda Cool"
          disabled={isPending}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="slug" className="font-sans text-xs uppercase tracking-[0.12em]">
          Identificador en la URL
        </Label>
        <div className="flex items-center gap-0 rounded-md border border-border bg-input/50 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-ring">
          <span className="select-none px-3 py-2 font-mono text-xs text-muted-foreground">
            /app/
          </span>
          <Input
            id="slug"
            required
            pattern="[a-z0-9\-]{2,40}"
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value)
              setSlugTouched(true)
            }}
            placeholder="mi-tienda-cool"
            disabled={isPending}
            className="border-0 bg-transparent font-mono text-sm shadow-none focus-visible:ring-0"
          />
        </div>
        <p className="font-sans text-xs text-muted-foreground">
          Solo letras minúsculas, números y guiones. No se puede cambiar después.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label className="font-sans text-xs uppercase tracking-[0.12em]">Tipo de negocio</Label>
          <Select value={businessType} onValueChange={setBusinessType} disabled={isPending}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="retail">Retail</SelectItem>
              <SelectItem value="wholesale">Mayorista</SelectItem>
              <SelectItem value="manufacturer">Fabricante</SelectItem>
              <SelectItem value="other">Otro</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label className="font-sans text-xs uppercase tracking-[0.12em]">Moneda</Label>
          <Select value={currency} onValueChange={setCurrency} disabled={isPending}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ARS">ARS — Peso Argentino</SelectItem>
              <SelectItem value="USD">USD — Dólar</SelectItem>
              <SelectItem value="EUR">EUR — Euro</SelectItem>
              <SelectItem value="BRL">BRL — Real</SelectItem>
              <SelectItem value="CLP">CLP — Peso Chileno</SelectItem>
              <SelectItem value="MXN">MXN — Peso Mexicano</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button type="submit" className="mt-2 shadow-signal" disabled={isPending}>
        {isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Creando...
          </>
        ) : (
          "Crear espacio"
        )}
      </Button>
    </form>
  )
}
