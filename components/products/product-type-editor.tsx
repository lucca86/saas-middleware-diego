"use client"

import { useEffect, useState, useTransition } from "react"
import { GripVertical, Plus, Trash2 } from "lucide-react"
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
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Spinner } from "@/components/ui/spinner"
import { upsertProductType } from "@/app/app/[tenant]/product-types/actions"
import type { AttributeDef, ProductType } from "@/lib/products/types"
import { slugify } from "@/lib/products/slug"

interface Props {
  tenantSlug: string
  open: boolean
  editing: ProductType | null
  onOpenChange: (open: boolean) => void
}

const EMPTY_ATTR: AttributeDef = {
  key: "",
  label: "",
  type: "select",
  options: [],
  is_variant: true,
  required: false,
}

export function ProductTypeEditor({ tenantSlug, open, editing, onOpenChange }: Props) {
  const [name, setName] = useState("")
  const [icon, setIcon] = useState("package")
  const [description, setDescription] = useState("")
  const [attributes, setAttributes] = useState<AttributeDef[]>([])
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (open) {
      if (editing) {
        setName(editing.name)
        setIcon(editing.icon ?? "package")
        setDescription(editing.description ?? "")
        setAttributes(editing.attributes ?? [])
      } else {
        setName("")
        setIcon("package")
        setDescription("")
        setAttributes([])
      }
    }
  }, [open, editing])

  function addAttribute() {
    setAttributes((prev) => [...prev, { ...EMPTY_ATTR, key: `attr_${prev.length + 1}` }])
  }

  function updateAttr(idx: number, patch: Partial<AttributeDef>) {
    setAttributes((prev) => prev.map((a, i) => (i === idx ? { ...a, ...patch } : a)))
  }

  function removeAttr(idx: number) {
    setAttributes((prev) => prev.filter((_, i) => i !== idx))
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const res = await upsertProductType(tenantSlug, {
        id: editing?.id,
        name: name.trim(),
        slug: editing?.slug,
        icon,
        description: description.trim(),
        attributes: attributes.map((a) => ({
          ...a,
          key: slugify(a.key || a.label).replace(/-/g, "_"),
          options: a.type === "select" ? (a.options ?? []).filter((o) => o.trim().length > 0) : undefined,
        })),
      })
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo guardar")
        return
      }
      toast.success(editing ? "Tipo actualizado" : "Tipo creado")
      onOpenChange(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? `Editar ${editing.name}` : "Nuevo tipo de producto"}</DialogTitle>
          <DialogDescription>
            Los atributos marcados como variante se combinan para generar SKUs (ej: talle × color).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="pt-name">Nombre</Label>
              <Input id="pt-name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="pt-icon">Ícono</Label>
              <Select value={icon} onValueChange={setIcon}>
                <SelectTrigger id="pt-icon">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="package">Paquete</SelectItem>
                  <SelectItem value="shirt">Indumentaria</SelectItem>
                  <SelectItem value="footprints">Calzado</SelectItem>
                  <SelectItem value="watch">Accesorio</SelectItem>
                  <SelectItem value="layers">Genérico</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="pt-desc">Descripción</Label>
            <Textarea
              id="pt-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Para qué se usa este tipo"
            />
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-border bg-card/40 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-sm font-bold text-foreground">Atributos</h3>
                <p className="text-xs text-muted-foreground">
                  Los de tipo <span className="font-mono">select</span> con opciones pueden generar variantes.
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addAttribute}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Atributo
              </Button>
            </div>

            <div className="flex flex-col gap-3">
              {attributes.length === 0 ? (
                <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                  Sin atributos. Agregá al menos uno para definir variantes.
                </p>
              ) : null}

              {attributes.map((a, idx) => (
                <div key={idx} className="rounded-md border border-border bg-background p-3">
                  <div className="flex items-start gap-2">
                    <GripVertical className="mt-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-12">
                      <div className="sm:col-span-4">
                        <Label className="mb-1 text-xs">Etiqueta</Label>
                        <Input
                          value={a.label}
                          onChange={(e) => updateAttr(idx, { label: e.target.value })}
                          placeholder="Talle"
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <Label className="mb-1 text-xs">Tipo</Label>
                        <Select
                          value={a.type}
                          onValueChange={(v: AttributeDef["type"]) =>
                            updateAttr(idx, {
                              type: v,
                              is_variant: v === "select" ? a.is_variant : false,
                              options: v === "select" ? (a.options ?? []) : undefined,
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="select">Lista</SelectItem>
                            <SelectItem value="text">Texto</SelectItem>
                            <SelectItem value="number">Número</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="sm:col-span-5">
                        {a.type === "select" ? (
                          <>
                            <Label className="mb-1 text-xs">Opciones (separadas por coma)</Label>
                            <Input
                              value={(a.options ?? []).join(", ")}
                              onChange={(e) =>
                                updateAttr(idx, {
                                  options: e.target.value
                                    .split(",")
                                    .map((o) => o.trim())
                                    .filter(Boolean),
                                })
                              }
                              placeholder="S, M, L, XL"
                            />
                          </>
                        ) : (
                          <>
                            <Label className="mb-1 text-xs">Ayuda (opcional)</Label>
                            <Input
                              value={a.help ?? ""}
                              onChange={(e) => updateAttr(idx, { help: e.target.value })}
                              placeholder="Texto de ayuda"
                            />
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-4 sm:col-span-12">
                        <label className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Switch
                            checked={a.is_variant}
                            disabled={a.type !== "select"}
                            onCheckedChange={(v) => updateAttr(idx, { is_variant: v })}
                          />
                          Genera variantes
                        </label>
                        <label className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Switch
                            checked={a.required ?? false}
                            onCheckedChange={(v) => updateAttr(idx, { required: v })}
                          />
                          Requerido
                        </label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="ml-auto text-destructive hover:text-destructive"
                          onClick={() => removeAttr(idx)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span className="sr-only">Quitar atributo</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Spinner className="mr-2 h-4 w-4" /> : null}
              {editing ? "Guardar cambios" : "Crear tipo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
