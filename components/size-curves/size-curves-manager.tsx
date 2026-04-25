"use client"

import { useMemo, useState } from "react"
import { ListChecks, Pencil, Plus, Sparkles, Trash2 } from "lucide-react"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SizeCurveEditor } from "./size-curve-editor"
import { deleteSizeCurve, seedDefaultLists } from "@/app/app/[tenant]/size-curves/actions"
import { OPTION_LIST_KIND_LABELS, type OptionListKind, type SizeCurve } from "@/lib/products/types"

interface Props {
  tenantSlug: string
  curves: SizeCurve[]
  canEdit: boolean
}

const SECTION_ORDER: OptionListKind[] = ["size", "color", "material", "other"]

export function SizeCurvesManager({ tenantSlug, curves, canEdit }: Props) {
  const [editing, setEditing] = useState<SizeCurve | null>(null)
  const [creatingKind, setCreatingKind] = useState<OptionListKind | null>(null)

  const grouped = useMemo(() => {
    const map = new Map<OptionListKind, SizeCurve[]>()
    for (const k of SECTION_ORDER) map.set(k, [])
    for (const c of curves) {
      const k = (c.kind ?? "size") as OptionListKind
      const arr = map.get(k) ?? []
      arr.push(c)
      map.set(k, arr)
    }
    return map
  }, [curves])

  const [seeding, setSeeding] = useState(false)

  async function onDelete(id: string) {
    const res = await deleteSizeCurve(tenantSlug, id)
    if (!res.ok) toast.error(res.error ?? "No se pudo eliminar")
    else toast.success("Lista eliminada")
  }

  async function onSeed() {
    setSeeding(true)
    try {
      const res = await seedDefaultLists(tenantSlug)
      if (!res.ok) {
        toast.error(res.error ?? "No se pudieron cargar las listas sugeridas")
        return
      }
      const inserted = res.inserted ?? 0
      const skipped = res.skipped ?? 0
      if (inserted === 0) {
        toast.info("Ya tenés todas las listas sugeridas cargadas")
      } else {
        toast.success(
          `${inserted} lista${inserted === 1 ? "" : "s"} agregada${inserted === 1 ? "" : "s"}` +
            (skipped > 0 ? ` (${skipped} ya existían)` : ""),
        )
      }
    } finally {
      setSeeding(false)
    }
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-end gap-2">
        {canEdit ? (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onSeed}
              disabled={seeding}
            >
              <Sparkles className="mr-1.5 h-4 w-4" />
              {seeding ? "Cargando…" : "Cargar listas sugeridas"}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="shadow-signal">
                  <Plus className="mr-1.5 h-4 w-4" />
                  Nueva lista
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setCreatingKind("size")}>Talles</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCreatingKind("color")}>Colores</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCreatingKind("material")}>Materiales</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCreatingKind("other")}>Otra</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        ) : null}
      </div>

      {curves.length === 0 ? (
        <Empty className="border border-dashed border-border bg-card/40">
          <EmptyMedia>
            <ListChecks className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>Sin listas todavía</EmptyTitle>
          <EmptyDescription>
            Creá listas reutilizables de talles, colores o materiales y enchufalas a tus tipos de producto.
          </EmptyDescription>
          {canEdit ? (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <Button onClick={onSeed} disabled={seeding}>
                <Sparkles className="mr-1.5 h-4 w-4" />
                {seeding ? "Cargando…" : "Cargar listas sugeridas"}
              </Button>
              <Button variant="outline" onClick={() => setCreatingKind("size")}>
                <Plus className="mr-1.5 h-4 w-4" />
                Crear desde cero
              </Button>
            </div>
          ) : null}
        </Empty>
      ) : (
        <div className="flex flex-col gap-8">
          {SECTION_ORDER.map((kind) => {
            const items = grouped.get(kind) ?? []
            if (items.length === 0) return null
            return (
              <section key={kind} className="flex flex-col gap-3">
                <div className="flex items-baseline gap-3">
                  <h2 className="font-display text-lg font-bold text-foreground">
                    {OPTION_LIST_KIND_LABELS[kind]}
                  </h2>
                  <span className="font-mono text-xs text-muted-foreground">{items.length}</span>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((c) => (
                    <article
                      key={c.id}
                      className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-display text-base font-bold leading-tight text-foreground">
                            {c.name}
                          </h3>
                          <p className="font-mono text-xs text-muted-foreground">{c.slug}</p>
                        </div>
                        {c.is_system ? <Badge variant="secondary">Sistema</Badge> : null}
                      </div>

                      {c.description ? (
                        <p className="text-pretty text-sm text-muted-foreground leading-relaxed">
                          {c.description}
                        </p>
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

                      <p className="text-xs text-muted-foreground">{c.values.length} valores</p>

                      {canEdit ? (
                        <div className="mt-auto flex items-center justify-end gap-2 border-t border-border pt-3">
                          <Button variant="ghost" size="sm" onClick={() => setEditing(c)}>
                            <Pencil className="mr-1.5 h-3.5 w-3.5" />
                            Editar
                          </Button>
                          {!c.is_system ? (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  <span className="sr-only">Eliminar</span>
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    Eliminar &ldquo;{c.name}&rdquo;
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Los tipos de producto que usen esta lista van a quedar sin opciones automáticas.
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
              </section>
            )
          })}
        </div>
      )}

      <SizeCurveEditor
        tenantSlug={tenantSlug}
        open={creatingKind !== null || editing !== null}
        editing={editing}
        defaultKind={creatingKind ?? "size"}
        onOpenChange={(o) => {
          if (!o) {
            setCreatingKind(null)
            setEditing(null)
          }
        }}
      />
    </>
  )
}
