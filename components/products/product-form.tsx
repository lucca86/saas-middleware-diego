"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, ExternalLink, Save, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  effectiveOptions,
  generateCombinations,
  variantAttributes,
  variantKey,
} from "@/lib/products/cartesian"
import { TagsInput } from "./tags-input"
import { VariantsMatrix, type VariantRow } from "./variants-matrix"
import { ProductImagesUploader } from "./product-images-uploader"
import { deleteProduct, saveProduct } from "@/app/app/[tenant]/products/actions"
import {
  OPTION_LIST_KIND_LABELS,
  type AttributeSelection,
  type Category,
  type Product,
  type ProductType,
  type ProductVariant,
  type SizeCurve,
} from "@/lib/products/types"
import type { ProductImage } from "@/lib/products/images"

interface Props {
  tenantSlug: string
  types: ProductType[]
  categories: Category[]
  curves: SizeCurve[]
  currency: string
  mode: "create" | "edit"
  readonly?: boolean
  initial?: { product: Product; variants: ProductVariant[]; images: ProductImage[] }
}

type SelectionsState = Record<string, AttributeSelection>

export function ProductForm({
  tenantSlug,
  types,
  categories,
  curves,
  currency,
  mode,
  readonly,
  initial,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [typeId, setTypeId] = useState<string | null>(initial?.product.type_id ?? types[0]?.id ?? null)
  const [categoryId, setCategoryId] = useState<string | null>(initial?.product.category_id ?? null)
  const [name, setName] = useState(initial?.product.name ?? "")
  const [sku, setSku] = useState(initial?.product.sku ?? "")
  const [description, setDescription] = useState(initial?.product.description ?? "")
  const [status, setStatus] = useState<Product["status"]>(initial?.product.status ?? "draft")
  const [tags, setTags] = useState<string[]>(initial?.product.tags ?? [])

  const selectedType = types.find((t) => t.id === typeId) ?? null
  const variantAttrs = useMemo(() => variantAttributes(selectedType?.attributes ?? []), [selectedType])

  // ----- Selections per variant attribute -----
  // Priority for initial values:
  //   1. product.attributes.selections (new shape)
  //   2. derived from existing variants (legacy products edited after upgrade)
  //   3. all available options for the attribute
  const [selections, setSelections] = useState<SelectionsState>(() => {
    const stored = initial?.product.attributes?.selections ?? {}
    const existingVariants = initial?.variants ?? []
    const next: SelectionsState = {}
    for (const attr of variantAttrs) {
      const fromStore = stored[attr.key]
      const curveId = fromStore?.curve_id ?? attr.source_curve_id ?? null
      const all = effectiveOptions(attr, curves, curveId)

      let values: string[]
      if (fromStore?.values && fromStore.values.length > 0) {
        values = fromStore.values
      } else if (existingVariants.length > 0) {
        // Derive from variants: keep only values that actually appear, preserving
        // the order defined by the source options.
        const used = new Set(
          existingVariants
            .map((v) => v.attributes?.[attr.key])
            .filter((x): x is string => typeof x === "string" && x.length > 0),
        )
        values = all.filter((opt) => used.has(opt))
        // If derivation produced nothing (e.g. variants use values not in current
        // options), fall back to whatever the variants had.
        if (values.length === 0) values = Array.from(used)
        if (values.length === 0) values = all
      } else {
        values = all
      }
      next[attr.key] = { curve_id: curveId, values }
    }
    return next
  })

  // ----- Variants state -----
  const [variants, setVariants] = useState<VariantRow[]>(() => {
    if (initial && initial.variants.length > 0) {
      return initial.variants
        .sort((a, b) => a.position - b.position)
        .map((v) => ({
          id: v.id,
          attributes: v.attributes ?? {},
          sku: v.sku ?? "",
          price: String(v.price ?? 0),
          stock: String(v.stock ?? 0),
          status: v.status,
        }))
    }
    return generateCombinations(
      variantAttrs,
      Object.fromEntries(variantAttrs.map((a) => [a.key, { values: effectiveOptions(a, curves, a.source_curve_id ?? null) }])),
    ).map((attrs) => ({
      attributes: attrs,
      sku: "",
      price: "0",
      stock: "0",
      status: "active" as const,
      isNew: true,
    }))
  })

  // Recompute variants whenever selections change (preserving existing rows by key).
  useEffect(() => {
    const combos = generateCombinations(variantAttrs, selections)
    setVariants((prev) => {
      const existingByKey = new Map(prev.map((v) => [variantKey(v.attributes), v]))
      return combos.map((attrs) => {
        const existing = existingByKey.get(variantKey(attrs))
        if (existing) return { ...existing, attributes: attrs }
        return {
          attributes: attrs,
          sku: "",
          price: "0",
          stock: "0",
          status: "active",
          isNew: true,
        }
      })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(selections), variantAttrs.map((a) => a.key).join("·")])

  function changeType(nextTypeId: string | null) {
    setTypeId(nextTypeId)
    const nextType = types.find((t) => t.id === nextTypeId) ?? null
    const nextAttrs = variantAttributes(nextType?.attributes ?? [])
    const nextSelections: SelectionsState = {}
    for (const attr of nextAttrs) {
      const curveId = attr.source_curve_id ?? null
      nextSelections[attr.key] = {
        curve_id: curveId,
        values: effectiveOptions(attr, curves, curveId),
      }
    }
    setSelections(nextSelections)
  }

  function toggleValue(attrKey: string, value: string) {
    setSelections((prev) => {
      const cur = prev[attrKey] ?? { values: [], curve_id: null }
      const set = new Set(cur.values)
      if (set.has(value)) set.delete(value)
      else set.add(value)
      return { ...prev, [attrKey]: { ...cur, values: Array.from(set) } }
    })
  }

  function setAttrCurve(attrKey: string, curveId: string | null) {
    const attr = variantAttrs.find((a) => a.key === attrKey)
    if (!attr) return
    const newOptions = effectiveOptions(attr, curves, curveId)
    setSelections((prev) => ({
      ...prev,
      [attrKey]: { curve_id: curveId, values: newOptions },
    }))
  }

  function selectAll(attrKey: string, all: boolean) {
    const attr = variantAttrs.find((a) => a.key === attrKey)
    if (!attr) return
    setSelections((prev) => {
      const cur = prev[attrKey] ?? { values: [], curve_id: null }
      const opts = effectiveOptions(attr, curves, cur.curve_id)
      return { ...prev, [attrKey]: { ...cur, values: all ? opts : [] } }
    })
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (readonly) return

    // Build attributes JSONB shape for storage
    const attributesPayload = {
      selections: Object.fromEntries(
        Object.entries(selections).map(([k, v]) => [
          k,
          { values: v.values, curve_id: v.curve_id ?? null },
        ]),
      ),
    }

    startTransition(async () => {
      const res = await saveProduct(tenantSlug, {
        id: initial?.product.id,
        type_id: typeId,
        category_id: categoryId,
        name: name.trim(),
        sku: sku.trim() || null,
        description: description.trim() || null,
        status,
        tags,
        attributes: attributesPayload,
        variants: variants.map((v) => ({
          id: v.id,
          attributes: v.attributes,
          sku: v.sku || null,
          price: Number.parseFloat(v.price || "0"),
          stock: Number.parseInt(v.stock || "0", 10),
          status: v.status,
        })),
      })
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo guardar")
        return
      }
      toast.success(mode === "create" ? "Producto creado" : "Cambios guardados")
      if (mode === "create" && res.productId) {
        router.push(`/app/${tenantSlug}/products/${res.productId}`)
      } else {
        router.refresh()
      }
    })
  }

  async function onDelete() {
    if (!initial?.product.id) return
    startTransition(async () => {
      const res = await deleteProduct(tenantSlug, initial.product.id)
      if (!res.ok) toast.error(res.error ?? "No se pudo eliminar")
    })
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm" type="button">
          <Link href={`/app/${tenantSlug}/products`}>
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Volver al catálogo
          </Link>
        </Button>
      </div>

      {/* General */}
      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="mb-4 font-display text-base font-bold text-foreground">General</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="p-name">Nombre</Label>
            <Input
              id="p-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
              maxLength={120}
              disabled={readonly}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="p-type">Tipo</Label>
            <Select value={typeId ?? "none"} onValueChange={(v) => changeType(v === "none" ? null : v)}>
              <SelectTrigger id="p-type" disabled={readonly}>
                <SelectValue placeholder="Sin tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin tipo</SelectItem>
                {types.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="p-sku">SKU base</Label>
            <Input
              id="p-sku"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              placeholder="REM-001"
              disabled={readonly}
            />
          </div>

          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="p-desc">Descripción</Label>
            <Textarea
              id="p-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={readonly}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="p-status">Estado</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as Product["status"])}>
              <SelectTrigger id="p-status" disabled={readonly}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Borrador</SelectItem>
                <SelectItem value="active">Activo</SelectItem>
                <SelectItem value="archived">Archivado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="p-cat">Categoría</Label>
              <Link
                href={`/app/${tenantSlug}/categories`}
                className="text-xs text-muted-foreground underline-offset-2 hover:underline"
              >
                Gestionar
                <ExternalLink className="ml-0.5 inline h-3 w-3" aria-hidden="true" />
              </Link>
            </div>
            <Select
              value={categoryId ?? "none"}
              onValueChange={(v) => setCategoryId(v === "none" ? null : v)}
            >
              <SelectTrigger id="p-cat" disabled={readonly}>
                <SelectValue placeholder="Sin categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin categoría</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label>Tags</Label>
            <TagsInput value={tags} onChange={setTags} placeholder={readonly ? "—" : "Agregar tag y Enter"} />
          </div>
        </div>
      </section>

      {/* Images */}
      {mode === "edit" && initial ? (
        <section className="rounded-lg border border-border bg-card p-5">
          <div className="mb-4">
            <h2 className="font-display text-base font-bold text-foreground">Imágenes</h2>
            <p className="text-xs text-muted-foreground">
              Subí fotos del producto. La primera se marca como principal y aparece en el catálogo.
            </p>
          </div>
          <ProductImagesUploader
            tenantSlug={tenantSlug}
            productId={initial.product.id}
            initial={initial.images}
            readonly={readonly}
          />
        </section>
      ) : (
        <section className="rounded-lg border border-dashed border-border bg-muted/30 p-5">
          <h2 className="font-display text-base font-bold text-foreground">Imágenes</h2>
          <p className="text-xs text-muted-foreground">Guardá el producto para poder subir imágenes.</p>
        </section>
      )}

      {/* Variant attributes (per-product selection) */}
      {variantAttrs.length > 0 ? (
        <section className="rounded-lg border border-border bg-card p-5">
          <div className="mb-4">
            <h2 className="font-display text-base font-bold text-foreground">Atributos de variante</h2>
            <p className="text-xs text-muted-foreground">
              Marcá solo los valores que aplican a este producto. La grilla se regenera automáticamente.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            {variantAttrs.map((attr) => {
              const sel = selections[attr.key] ?? { values: [], curve_id: null }
              const curveId = sel.curve_id ?? attr.source_curve_id ?? null
              const options = effectiveOptions(attr, curves, curveId)
              const allChecked = options.length > 0 && sel.values.length === options.length
              const noneChecked = sel.values.length === 0

              return (
                <div key={attr.key} className="rounded-md border border-border bg-background p-4">
                  <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                    <div>
                      <h3 className="font-display text-sm font-bold text-foreground">{attr.label}</h3>
                      <p className="font-mono text-[11px] text-muted-foreground">{attr.key}</p>
                    </div>
                    {curves.length > 0 ? (
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground">Lista</Label>
                        <Select
                          value={curveId ?? "none"}
                          onValueChange={(v) => setAttrCurve(attr.key, v === "none" ? null : v)}
                        >
                          <SelectTrigger className="h-8 w-56" disabled={readonly}>
                            <SelectValue placeholder="Manual" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Manual (del tipo)</SelectItem>
                            {curves.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                <span className="text-muted-foreground">
                                  [{OPTION_LIST_KIND_LABELS[c.kind ?? "size"]}]
                                </span>{" "}
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : null}
                  </div>

                  {options.length === 0 ? (
                    <p className="rounded-md border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
                      No hay opciones disponibles. Editá el tipo de producto o la curva para agregar valores.
                    </p>
                  ) : (
                    <>
                      <div className="flex flex-wrap gap-2">
                        {options.map((opt) => {
                          const checked = sel.values.includes(opt)
                          return (
                            <label
                              key={opt}
                              className={`inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 font-mono text-xs transition ${
                                checked
                                  ? "border-primary bg-primary/10 text-foreground"
                                  : "border-border bg-card text-muted-foreground hover:border-primary/40"
                              } ${readonly ? "pointer-events-none opacity-70" : ""}`}
                            >
                              <input
                                type="checkbox"
                                className="sr-only"
                                checked={checked}
                                disabled={readonly}
                                onChange={() => toggleValue(attr.key, opt)}
                              />
                              {opt}
                            </label>
                          )
                        })}
                      </div>
                      {!readonly ? (
                        <div className="mt-3 flex items-center gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={allChecked}
                            onClick={() => selectAll(attr.key, true)}
                          >
                            Marcar todos
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={noneChecked}
                            onClick={() => selectAll(attr.key, false)}
                          >
                            Desmarcar
                          </Button>
                          <span className="ml-auto font-mono text-[11px] text-muted-foreground">
                            {sel.values.length}/{options.length} seleccionados
                          </span>
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      ) : null}

      {/* Variants matrix */}
      <section className="rounded-lg border border-border bg-card p-5">
        <div className="mb-4 flex items-end justify-between gap-2">
          <div>
            <h2 className="font-display text-base font-bold text-foreground">Variantes</h2>
            <p className="text-xs text-muted-foreground">
              {variantAttrs.length === 0
                ? "Producto simple. Solo se generará una variante por defecto."
                : `Se combinan ${variantAttrs.map((a) => a.label.toLowerCase()).join(" × ")} para generar la grilla.`}
            </p>
          </div>
        </div>

        <VariantsMatrix
          variantAttrs={variantAttrs}
          variants={variants}
          onChange={setVariants}
          currency={currency}
          readonly={readonly}
        />
      </section>

      {/* Footer */}
      {!readonly ? (
        <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card/80 p-3 backdrop-blur">
          {mode === "edit" ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                  <Trash2 className="mr-1.5 h-4 w-4" />
                  Eliminar producto
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Eliminar &ldquo;{name}&rdquo;?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esto borra el producto y todas sus variantes. Esta acción no se puede deshacer.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={onDelete}>Eliminar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <span />
          )}

          <div className="ml-auto flex items-center gap-2">
            <Button asChild type="button" variant="ghost" size="sm">
              <Link href={`/app/${tenantSlug}/products`}>Cancelar</Link>
            </Button>
            <Button type="submit" disabled={isPending} className="shadow-signal">
              {isPending ? <Spinner className="mr-2 h-4 w-4" /> : <Save className="mr-1.5 h-4 w-4" />}
              {mode === "create" ? "Crear producto" : "Guardar cambios"}
            </Button>
          </div>
        </div>
      ) : null}
    </form>
  )
}
