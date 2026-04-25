"use client"

import { useEffect, useState, useTransition } from "react"
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Spinner } from "@/components/ui/spinner"
import { upsertSizeCurve } from "@/app/app/[tenant]/size-curves/actions"
import type { OptionListKind, SizeCurve } from "@/lib/products/types"

interface Props {
  tenantSlug: string
  open: boolean
  editing: SizeCurve | null
  defaultKind?: OptionListKind
  onOpenChange: (open: boolean) => void
}

const PLACEHOLDERS: Record<OptionListKind, { name: string; values: string; description: string }> = {
  size: {
    name: "1 a 5 años",
    values: "1a2 años, 2a3 años, 3a4 años",
    description: "Para indumentaria infantil",
  },
  color: {
    name: "Básicos",
    values: "Negro, Blanco, Gris, Azul",
    description: "Paleta base de la temporada",
  },
  material: {
    name: "Materiales",
    values: "Algodón, Lino, Poliéster",
    description: "Composiciones disponibles",
  },
  other: {
    name: "Capacidades",
    values: "250ml, 500ml, 1L",
    description: "Lista personalizada",
  },
}

export function SizeCurveEditor({ tenantSlug, open, editing, defaultKind = "size", onOpenChange }: Props) {
  const [name, setName] = useState("")
  const [kind, setKind] = useState<OptionListKind>(defaultKind)
  const [description, setDescription] = useState("")
  const [values, setValues] = useState<string[]>([])
  const [draft, setDraft] = useState("")
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (open) {
      setName(editing?.name ?? "")
      setKind(editing?.kind ?? defaultKind)
      setDescription(editing?.description ?? "")
      setValues(editing?.values ?? [])
      setDraft("")
    }
  }, [open, editing, defaultKind])

  const ph = PLACEHOLDERS[kind]
  const valueLabel =
    kind === "size" ? "Talles" : kind === "color" ? "Colores" : kind === "material" ? "Materiales" : "Valores"

  function addDraft() {
    const t = draft.trim()
    if (!t) return
    if (values.includes(t)) {
      toast.error("Ese valor ya existe en la lista")
      return
    }
    setValues((prev) => [...prev, t])
    setDraft("")
  }

  function bulkAdd(text: string) {
    const tokens = text
      .split(/[\n,]/g)
      .map((s) => s.trim())
      .filter(Boolean)
    if (tokens.length === 0) return
    setValues((prev) => {
      const set = new Set(prev)
      const next = [...prev]
      for (const t of tokens) {
        if (!set.has(t)) {
          set.add(t)
          next.push(t)
        }
      }
      return next
    })
    setDraft("")
  }

  function move(idx: number, dir: -1 | 1) {
    setValues((prev) => {
      const next = [...prev]
      const swap = idx + dir
      if (swap < 0 || swap >= next.length) return next
      ;[next[idx], next[swap]] = [next[swap], next[idx]]
      return next
    })
  }

  function remove(idx: number) {
    setValues((prev) => prev.filter((_, i) => i !== idx))
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (values.length === 0) {
      toast.error("Agregá al menos un valor")
      return
    }
    startTransition(async () => {
      const res = await upsertSizeCurve(tenantSlug, {
        id: editing?.id,
        name: name.trim(),
        kind,
        description: description.trim() || undefined,
        values,
      })
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo guardar")
        return
      }
      toast.success(editing ? "Lista actualizada" : "Lista creada")
      onOpenChange(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? `Editar ${editing.name}` : "Nueva lista de opciones"}</DialogTitle>
          <DialogDescription>
            Listá los valores en el orden en que querés que aparezcan en las grillas. Podés pegar varios separados
            por coma o salto de línea.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="sc-kind">Tipo de lista</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as OptionListKind)}>
                <SelectTrigger id="sc-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="size">Talles</SelectItem>
                  <SelectItem value="color">Colores</SelectItem>
                  <SelectItem value="material">Materiales</SelectItem>
                  <SelectItem value="other">Otra</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="sc-name">Nombre</Label>
              <Input
                id="sc-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
                placeholder={ph.name}
              />
            </div>
            <div className="flex flex-col gap-2 sm:col-span-3">
              <Label htmlFor="sc-desc">Descripción (opcional)</Label>
              <Textarea
                id="sc-desc"
                rows={1}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={ph.description}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 rounded-lg border border-border bg-card/40 p-4">
            <Label>{valueLabel}</Label>
            <div className="flex items-center gap-2">
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    addDraft()
                  }
                }}
                onPaste={(e) => {
                  const text = e.clipboardData.getData("text")
                  if (/[,\n]/.test(text)) {
                    e.preventDefault()
                    bulkAdd(text)
                  }
                }}
                placeholder={`Ej: ${ph.values}`}
              />
              <Button type="button" variant="outline" size="sm" onClick={addDraft}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                Agregar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Pegá varios separados por coma o salto de línea para cargarlos de una.
            </p>

            {values.length === 0 ? (
              <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                Sin valores. Agregá al menos uno.
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {values.map((v, idx) => (
                  <li
                    key={`${v}-${idx}`}
                    className="flex items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-1.5"
                  >
                    <span className="font-mono text-sm">{v}</span>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => move(idx, -1)}
                        disabled={idx === 0}
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                        <span className="sr-only">Subir</span>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => move(idx, 1)}
                        disabled={idx === values.length - 1}
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                        <span className="sr-only">Bajar</span>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => remove(idx)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="sr-only">Quitar</span>
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Spinner className="mr-2 h-4 w-4" /> : null}
              {editing ? "Guardar cambios" : "Crear lista"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
