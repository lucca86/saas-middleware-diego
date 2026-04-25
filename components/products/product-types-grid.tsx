"use client"

import { useState } from "react"
import { Footprints, Layers, Package, Pencil, Plus, Shirt, Trash2, Watch } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { toast } from "sonner"
import { ProductTypeEditor } from "./product-type-editor"
import { deleteProductType } from "@/app/app/[tenant]/product-types/actions"
import type { ProductType, SizeCurve } from "@/lib/products/types"

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  package: Package,
  shirt: Shirt,
  footprints: Footprints,
  watch: Watch,
  layers: Layers,
}

interface Props {
  tenantSlug: string
  types: ProductType[]
  curves: SizeCurve[]
  canEdit: boolean
}

export function ProductTypesGrid({ tenantSlug, types, curves, canEdit }: Props) {
  const [editing, setEditing] = useState<ProductType | null>(null)
  const [creating, setCreating] = useState(false)

  async function onDelete(id: string) {
    const res = await deleteProductType(tenantSlug, id)
    if (!res.ok) toast.error(res.error ?? "No se pudo eliminar")
    else toast.success("Tipo eliminado")
  }

  function curveCount(curveId: string | null | undefined): number | null {
    if (!curveId) return null
    const c = curves.find((x) => x.id === curveId)
    return c?.values.length ?? null
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {types.map((t) => {
          const Icon = ICONS[t.icon ?? "package"] ?? Package
          const variantAttrs = t.attributes.filter((a) => a.is_variant)
          const otherAttrs = t.attributes.filter((a) => !a.is_variant)

          return (
            <article
              key={t.id}
              className="card-accent-cyan flex flex-col gap-4 rounded-lg border border-border bg-card p-5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-display text-base font-bold leading-tight text-foreground">{t.name}</h2>
                    <p className="font-mono text-xs text-muted-foreground">{t.slug}</p>
                  </div>
                </div>
                {t.is_system ? <Badge variant="secondary">Sistema</Badge> : null}
              </div>

              {t.description ? (
                <p className="text-pretty text-sm text-muted-foreground leading-relaxed">{t.description}</p>
              ) : null}

              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Variantes</dt>
                  <dd className="mt-1 font-display text-lg font-bold text-foreground">{variantAttrs.length}</dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Atributos</dt>
                  <dd className="mt-1 font-display text-lg font-bold text-foreground">{otherAttrs.length}</dd>
                </div>
              </dl>

              {variantAttrs.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {variantAttrs.map((a) => {
                    const fromCurve = curveCount(a.source_curve_id)
                    const count = fromCurve ?? a.options?.length ?? 0
                    return (
                      <Badge key={a.key} variant="outline" className="font-normal">
                        {a.label}
                        {count > 0 ? <span className="ml-1 text-muted-foreground">· {count}</span> : null}
                        {fromCurve !== null ? <span className="ml-1 text-primary">·curva</span> : null}
                      </Badge>
                    )
                  })}
                </div>
              ) : null}

              {canEdit ? (
                <div className="mt-auto flex items-center justify-end gap-2 border-t border-border pt-3">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(t)}>
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                    Editar
                  </Button>
                  {!t.is_system ? (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                          <span className="sr-only">Eliminar</span>
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Eliminar &ldquo;{t.name}&rdquo;</AlertDialogTitle>
                          <AlertDialogDescription>
                            Los productos que usen este tipo no se eliminarán, pero quedarán sin tipo asignado.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => onDelete(t.id)}>Eliminar</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  ) : null}
                </div>
              ) : null}
            </article>
          )
        })}

        {canEdit ? (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex min-h-[200px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-card/40 p-5 text-muted-foreground transition hover:border-primary hover:text-primary"
          >
            <Plus className="h-6 w-6" aria-hidden="true" />
            <span className="font-display text-sm font-bold">Nuevo tipo</span>
            <span className="text-xs">Definí atributos personalizados</span>
          </button>
        ) : null}
      </div>

      <ProductTypeEditor
        tenantSlug={tenantSlug}
        open={creating || editing !== null}
        editing={editing}
        curves={curves}
        onOpenChange={(o) => {
          if (!o) {
            setCreating(false)
            setEditing(null)
          }
        }}
      />
    </>
  )
}
