"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Save, Trash2 } from "lucide-react"
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
import { generateCombinations, variantAttributes, variantKey } from "@/lib/products/cartesian"
import { TagsInput } from "./tags-input"
import { VariantsMatrix, type VariantRow } from "./variants-matrix"
import { deleteProduct, saveProduct } from "@/app/app/[tenant]/products/actions"
import type { Product, ProductType, ProductVariant } from "@/lib/products/types"

interface Props {
  tenantSlug: string
  types: ProductType[]
  currency: string
  mode: "create" | "edit"
  readonly?: boolean
  initial?: { product: Product; variants: ProductVariant[] }
}

export function ProductForm({ tenantSlug, types, currency, mode, readonly, initial }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [typeId, setTypeId] = useState<string | null>(initial?.product.type_id ?? types[0]?.id ?? null)
  const [name, setName] = useState(initial?.product.name ?? "")
  const [sku, setSku] = useState(initial?.product.sku ?? "")
  const [description, setDescription] = useState(initial?.product.description ?? "")
  const [status, setStatus] = useState<Product["status"]>(initial?.product.status ?? "draft")
  const [category, setCategory] = useState(initial?.product.category ?? "")
  const [tags, setTags] = useState<string[]>(initial?.product.tags ?? [])

  const selectedType = types.find((t) => t.id === typeId) ?? null
  const variantAttrs = useMemo(() => variantAttributes(selectedType?.attributes ?? []), [selectedType])

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
    return generateCombinations(selectedType?.attributes ?? []).map((attrs) => ({
      attributes: attrs,
      sku: "",
      price: "0",
      stock: "0",
      status: "active" as const,
      isNew: true,
    }))
  })

  function regenerateVariants(nextTypeId: string | null) {
    setTypeId(nextTypeId)
    const nextType = types.find((t) => t.id === nextTypeId) ?? null
    const combos = generateCombinations(nextType?.attributes ?? [])
    const existingByKey = new Map(variants.map((v) => [variantKey(v.attributes), v]))

    const next: VariantRow[] = combos.map((attrs) => {
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
    setVariants(next)
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (readonly) return

    startTransition(async () => {
      const res = await saveProduct(tenantSlug, {
        id: initial?.product.id,
        type_id: typeId,
        name: name.trim(),
        sku: sku.trim() || null,
        description: description.trim() || null,
        status,
        category: category.trim() || null,
        tags,
        attributes: initial?.product.attributes ?? {},
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
            <Select value={typeId ?? "none"} onValueChange={(v) => regenerateVariants(v === "none" ? null : v)}>
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
            <Label htmlFor="p-cat">Categoría</Label>
            <Input
              id="p-cat"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Remeras"
              disabled={readonly}
            />
          </div>

          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label>Tags</Label>
            <TagsInput value={tags} onChange={setTags} placeholder={readonly ? "—" : "Agregar tag y Enter"} />
          </div>
        </div>
      </section>

      {/* Variants */}
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
