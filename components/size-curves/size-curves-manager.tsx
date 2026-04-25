"use client"

import { useState } from "react"
import { Pencil, Plus, Ruler, Trash2 } from "lucide-react"
import { toast } from "sonner"
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
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { SizeCurveEditor } from "./size-curve-editor"
import { deleteSizeCurve } from "@/app/app/[tenant]/size-curves/actions"
import type { SizeCurve } from "@/lib/products/types"

interface Props {
  tenantSlug: string
  curves: SizeCurve[]
  canEdit: boolean
}

export function SizeCurvesManager({ tenantSlug, curves, canEdit }: Props) {
  const [editing, setEditing] = useState<SizeCurve | null>(null)
  const [creating, setCreating] = useState(false)

  async function onDelete(id: string) {
    const res = await deleteSizeCurve(tenantSlug, id)
    if (!res.ok) toast.error(res.error ?? "No se pudo eliminar")
    else toast.success("Curva eliminada")
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-end">
        {canEdit ? (
          <Button size="sm" onClick={() => setCreating(true)} className="shadow-signal">
            <Plus className="mr-1.5 h-4 w-4" />
            Nueva curva
          </Button>
        ) : null}
      </div>

      {curves.length === 0 ? (
        <Empty className="border border-dashed border-border bg-card/40">
          <EmptyMedia>
            <Ruler className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>Sin curvas todavía</EmptyTitle>
          <EmptyDescription>
            Creá una curva con los talles que usás (ej: 1a2 años, 2a3 años, 3a4 años...) y reutilizala en distintos
            tipos de producto.
          </EmptyDescription>
        </Empty>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {curves.map((c) => (
            <article
              key={c.id}
              className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="font-display text-base font-bold leading-tight text-foreground">{c.name}</h2>
                  <p className="font-mono text-xs text-muted-foreground">{c.slug}</p>
                </div>
                {c.is_system ? <Badge variant="secondary">Sistema</Badge> : null}
              </div>

              {c.description ? (
                <p className="text-pretty text-sm text-muted-foreground leading-relaxed">{c.description}</p>
              ) : null}

              <div className="flex flex-wrap gap-1.5">
                {c.values.length === 0 ? (
                  <span className="text-xs text-muted-foreground">Sin valores</span>
                ) : (
                  c.values.map((v) => (
                    <Badge key={v} variant="outline" className="font-mono">
                      {v}
                    </Badge>
                  ))
                )}
              </div>

              <p className="text-xs text-muted-foreground">{c.values.length} talles</p>

              {canEdit ? (
                <div className="mt-auto flex items-center justify-end gap-2 border-t border-border pt-3">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(c)}>
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                    Editar
                  </Button>
                  {!c.is_system ? (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                          <span className="sr-only">Eliminar</span>
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Eliminar &ldquo;{c.name}&rdquo;</AlertDialogTitle>
                          <AlertDialogDescription>
                            Los tipos de producto que usen esta curva van a quedar sin opciones automáticas.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => onDelete(c.id)}>Eliminar</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  ) : null}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}

      <SizeCurveEditor
        tenantSlug={tenantSlug}
        open={creating || editing !== null}
        editing={editing}
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
