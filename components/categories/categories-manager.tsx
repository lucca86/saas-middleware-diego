"use client"

import { useState, useTransition } from "react"
import { Pencil, Plus, Tag, Trash2 } from "lucide-react"
import { toast } from "sonner"
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
import { Textarea } from "@/components/ui/textarea"
import { Spinner } from "@/components/ui/spinner"
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { deleteCategory, upsertCategory } from "@/app/app/[tenant]/categories/actions"
import type { Category } from "@/lib/products/types"

interface Props {
  tenantSlug: string
  categories: Category[]
  canEdit: boolean
}

export function CategoriesManager({ tenantSlug, categories, canEdit }: Props) {
  const [editing, setEditing] = useState<Category | null>(null)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [isPending, startTransition] = useTransition()

  function openCreate() {
    setEditing(null)
    setName("")
    setDescription("")
    setCreating(true)
  }

  function openEdit(c: Category) {
    setEditing(c)
    setName(c.name)
    setDescription(c.description ?? "")
    setCreating(true)
  }

  function close() {
    setCreating(false)
    setEditing(null)
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const res = await upsertCategory(tenantSlug, {
        id: editing?.id,
        name: name.trim(),
        description: description.trim() || undefined,
        position: editing?.position ?? 0,
      })
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo guardar")
        return
      }
      toast.success(editing ? "Categoría actualizada" : "Categoría creada")
      close()
    })
  }

  function onDelete(id: string) {
    startTransition(async () => {
      const res = await deleteCategory(tenantSlug, id)
      if (!res.ok) toast.error(res.error ?? "No se pudo eliminar")
      else toast.success("Categoría eliminada")
    })
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-end">
        {canEdit ? (
          <Button size="sm" onClick={openCreate} className="shadow-signal">
            <Plus className="mr-1.5 h-4 w-4" />
            Nueva categoría
          </Button>
        ) : null}
      </div>

      {categories.length === 0 ? (
        <Empty className="border border-dashed border-border bg-card/40">
          <EmptyMedia>
            <Tag className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>Sin categorías</EmptyTitle>
          <EmptyDescription>
            Creá categorías como &ldquo;Indumentaria&rdquo;, &ldquo;Calzado&rdquo;, &ldquo;Accesorios&rdquo; para
            organizar tu catálogo.
          </EmptyDescription>
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Nombre
                </TableHead>
                <TableHead className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Slug
                </TableHead>
                <TableHead className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Descripción
                </TableHead>
                <TableHead className="w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-display text-sm font-bold text-foreground">{c.name}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{c.slug}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{c.description ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    {canEdit ? (
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>
                          <Pencil className="h-3.5 w-3.5" />
                          <span className="sr-only">Editar</span>
                        </Button>
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
                                Los productos en esta categoría no se eliminan, pero quedan sin categoría asignada.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => onDelete(c.id)}>Eliminar</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={creating} onOpenChange={(o) => (o ? setCreating(true) : close())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? `Editar ${editing.name}` : "Nueva categoría"}</DialogTitle>
            <DialogDescription>Las categorías se asignan a los productos al crearlos o editarlos.</DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="cat-name">Nombre</Label>
              <Input
                id="cat-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
                maxLength={60}
                placeholder="Indumentaria"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="cat-desc">Descripción (opcional)</Label>
              <Textarea
                id="cat-desc"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={300}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={close}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? <Spinner className="mr-2 h-4 w-4" /> : null}
                {editing ? "Guardar cambios" : "Crear categoría"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
