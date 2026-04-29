"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowUpRight, ExternalLink, Plus } from "lucide-react"
import { toast } from "sonner"

import { createTenant } from "@/app/admin/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export interface AdminTenantRow {
  id: string
  slug: string
  name: string
  member_count: number
  product_count: number
  is_storefront_published: boolean
  created_at: string
}

export function AdminTenantsClient({ tenants }: { tenants: AdminTenantRow[] }) {
  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header wraps on mobile so the CTA button never collides with the title. */}
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-xl font-bold tracking-tight md:text-2xl">Tenants</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {tenants.length} tenant{tenants.length === 1 ? "" : "s"} activo
            {tenants.length === 1 ? "" : "s"} en la plataforma.
          </p>
        </div>
        <NewTenantDialog />
      </div>

      <Card>
        <CardContent className="p-0">
          {/* Horizontal scroll inside the card prevents the whole shell from
              overflowing on narrow viewports while keeping the table layout. */}
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenant</TableHead>
                <TableHead className="text-right">Miembros</TableHead>
                <TableHead className="text-right">Productos</TableHead>
                <TableHead>Storefront</TableHead>
                <TableHead>Creado</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <div className="font-medium text-foreground">{t.name}</div>
                    <div className="font-mono text-xs text-muted-foreground">/{t.slug}</div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{t.member_count}</TableCell>
                  <TableCell className="text-right tabular-nums">{t.product_count}</TableCell>
                  <TableCell>
                    {t.is_storefront_published ? (
                      <Badge className="border-success/30 bg-success/15 text-success">Publicado</Badge>
                    ) : (
                      <Badge variant="outline">Borrador</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    <ClientDate iso={t.created_at} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/app/${t.slug}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                        title="Abrir como tenant"
                      >
                        <ArrowUpRight className="h-4 w-4" />
                      </Link>
                      {t.is_storefront_published ? (
                        <Link
                          href={`/s/${t.slug}`}
                          target="_blank"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                          title="Ver storefront público"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {tenants.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                    Todavía no hay tenants en la plataforma. Creá el primero con &ldquo;Nuevo tenant&rdquo;.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * Renders dates client-side to avoid SSR/CSR locale mismatches. The server
 * pass shows a stable placeholder; after mount we swap to `es-AR`.
 */
function ClientDate({ iso }: { iso: string }) {
  const [text, setText] = useState<string>("…")
  if (typeof window !== "undefined" && text === "…") {
    setText(new Date(iso).toLocaleDateString("es-AR"))
  }
  return <span suppressHydrationWarning>{text}</span>
}

function slugifyPreview(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
}

function NewTenantDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [slugTouched, setSlugTouched] = useState(false)
  const [businessType, setBusinessType] = useState("")
  const [pending, start] = useTransition()

  // Auto-fill slug from name unless the user typed it explicitly.
  const effectiveSlug = slugTouched ? slug : slugifyPreview(name)

  function reset() {
    setName("")
    setSlug("")
    setSlugTouched(false)
    setBusinessType("")
  }

  function handleSubmit() {
    start(async () => {
      const res = await createTenant({
        name,
        slug: effectiveSlug,
        businessType: businessType || undefined,
      })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(`Tenant /${res.slug} creado`)
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
        <Button size="sm" className="shadow-signal">
          <Plus className="mr-1.5 h-4 w-4" />
          Nuevo tenant
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Crear nuevo tenant</DialogTitle>
          <DialogDescription>
            Quedás como owner por defecto. Después podés agregar más miembros desde Usuarios.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="tenant-name">Nombre</Label>
            <Input
              id="tenant-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Viditas"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tenant-slug">Slug (URL)</Label>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">/app/</span>
              <Input
                id="tenant-slug"
                value={effectiveSlug}
                onChange={(e) => {
                  setSlug(e.target.value)
                  setSlugTouched(true)
                }}
                placeholder="viditas"
                className="font-mono"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Sólo letras minúsculas, números y guiones. Se usa en la URL del panel y del storefront.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tenant-business">Tipo de negocio (opcional)</Label>
            <Input
              id="tenant-business"
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
              placeholder="Indumentaria, gastronomía, etc."
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={pending || name.trim().length < 2 || effectiveSlug.length < 2}
          >
            {pending ? "Creando..." : "Crear tenant"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
