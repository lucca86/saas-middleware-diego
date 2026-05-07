"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { upsertProductType } from "@/app/app/[tenant]/product-types/actions"
import { slugify } from "@/lib/products/slug"
import {
  OPTION_LIST_KIND_LABELS,
  type AttributeDef,
  type OptionListKind,
  type ProductType,
  type SizeCurve,
} from "@/lib/products/types"

interface Props {
  tenantSlug: string
  productType: ProductType
  curves: SizeCurve[]
  /** Optional list of slugs the dialog should suggest as quick presets. */
  suggestions?: Array<{ label: string; key: string; curveKind?: OptionListKind }>
  trigger?: React.ReactNode
}

const DEFAULT_SUGGESTIONS: Props["suggestions"] = [
  { label: "Color", key: "color", curveKind: "color" },
  { label: "Talle", key: "talle", curveKind: "size" },
  { label: "Material", key: "material", curveKind: "material" },
]

/**
 * Quick-action dialog to add a new variant attribute to a product type
 * directly from the product form, without forcing the user to navigate
 * to /product-types. The attribute is appended to the existing type and
 * the page is refreshed so the new attribute appears in the variant
 * selections immediately.
 */
export function AddVariantAttributeDialog({
  tenantSlug,
  productType,
  curves,
  suggestions = DEFAULT_SUGGESTIONS,
  trigger,
}: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState("")
  const [source, setSource] = useState<"manual" | "curve">("manual")
  const [curveId, setCurveId] = useState<string | null>(null)
  const [optionsCsv, setOptionsCsv] = useState("")
  const [isPending, startTransition] = useTransition()

  function reset() {
    setLabel("")
    setSource("manual")
    setCurveId(null)
    setOptionsCsv("")
  }

  function applySuggestion(s: NonNullable<Props["suggestions"]>[number]) {
    setLabel(s.label)
    if (s.curveKind) {
      const match = curves.find((c) => (c.kind ?? "size") === s.curveKind)
      if (match) {
        setSource("curve")
        setCurveId(match.id)
        return
      }
    }
    setSource("manual")
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!label.trim()) return
    const baseKey = slugify(label).replace(/-/g, "_")
    if (!baseKey) {
      toast.error("Etiqueta inválida")
      return
    }
    if (productType.attributes.some((a) => a.key === baseKey)) {
      toast.error(`Ya existe un atributo con clave "${baseKey}" en este tipo`)
      return
    }

    const newAttr: AttributeDef = {
      key: baseKey,
      label: label.trim(),
      type: "select",
      is_variant: true,
      required: false,
      options:
        source === "manual"
          ? optionsCsv
              .split(",")
              .map((o) => o.trim())
              .filter(Boolean)
          : undefined,
      source_curve_id: source === "curve" ? curveId : null,
    }

    if (source === "manual" && (newAttr.options?.length ?? 0) === 0) {
      toast.error("Agregá al menos una opción o elegí una lista")
      return
    }
    if (source === "curve" && !curveId) {
      toast.error("Elegí una lista")
      return
    }

    startTransition(async () => {
      const res = await upsertProductType(tenantSlug, {
        id: productType.id,
        name: productType.name,
        slug: productType.slug,
        icon: productType.icon ?? "package",
        description: productType.description ?? "",
        attributes: [...productType.attributes, newAttr],
      })
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo agregar")
        return
      }
      toast.success(`Atributo "${newAttr.label}" agregado al tipo`)
      reset()
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) reset()
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button type="button" variant="outline" size="sm">
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Agregar atributo
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo atributo de variante</DialogTitle>
          <DialogDescription>
            Se agrega al tipo <span className="font-mono text-foreground">{productType.name}</span> y queda
            disponible para todos sus productos.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          {/* Quick presets */}
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <Button
                key={s.key}
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => applySuggestion(s)}
              >
                {s.label}
              </Button>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="va-label">Etiqueta</Label>
            <Input
              id="va-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Color, Talle, Material…"
              required
              autoFocus
              maxLength={40}
            />
            <p className="font-mono text-[11px] text-muted-foreground">
              Clave: {slugify(label).replace(/-/g, "_") || "—"}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="va-source">Origen de los valores</Label>
            <Select value={source} onValueChange={(v: "manual" | "curve") => setSource(v)}>
              <SelectTrigger id="va-source">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual (yo escribo las opciones)</SelectItem>
                <SelectItem value="curve" disabled={curves.length === 0}>
                  Desde una lista existente
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {source === "manual" ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="va-opts">Opciones (separadas por coma)</Label>
              <Input
                id="va-opts"
                value={optionsCsv}
                onChange={(e) => setOptionsCsv(e.target.value)}
                placeholder="Negro, Blanco, Rojo"
              />
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Label htmlFor="va-curve">Lista</Label>
              <Select value={curveId ?? ""} onValueChange={(v) => setCurveId(v || null)}>
                <SelectTrigger id="va-curve">
                  <SelectValue placeholder="Elegí una lista" />
                </SelectTrigger>
                <SelectContent>
                  {(["size", "color", "material", "other"] as OptionListKind[]).flatMap((kind) => {
                    const group = curves.filter((c) => (c.kind ?? "size") === kind)
                    if (group.length === 0) return []
                    return [
                      <div
                        key={`label-${kind}`}
                        className="px-2 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground"
                      >
                        {OPTION_LIST_KIND_LABELS[kind]}
                      </div>,
                      ...group.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}{" "}
                          <span className="text-muted-foreground">({c.values.length})</span>
                        </SelectItem>
                      )),
                    ]
                  })}
                </SelectContent>
              </Select>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Spinner className="mr-2 h-4 w-4" /> : null}
              Agregar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
