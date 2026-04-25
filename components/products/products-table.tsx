import Link from "next/link"
import Image from "next/image"
import { ImageOff, Package } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Empty, EmptyContent, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { ProductWithCounts } from "@/lib/products/types"

interface Props {
  tenantSlug: string
  items: ProductWithCounts[]
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  active: "default",
  draft: "secondary",
  archived: "outline",
}

const STATUS_LABEL: Record<string, string> = {
  active: "Activo",
  draft: "Borrador",
  archived: "Archivado",
}

export function ProductsTable({ tenantSlug, items }: Props) {
  if (items.length === 0) {
    return (
      <Empty className="border border-dashed border-border bg-card/40">
        <EmptyMedia>
          <Package className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>Sin productos todavía</EmptyTitle>
        <EmptyDescription>Creá tu primer producto para empezar a sincronizar tu inventario.</EmptyDescription>
        <EmptyContent>
          <Link
            href={`/app/${tenantSlug}/products/new`}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 font-display text-sm font-bold text-primary-foreground shadow-signal transition hover:bg-primary/90"
          >
            Crear producto
          </Link>
        </EmptyContent>
      </Empty>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-14" />
            <TableHead className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Producto
            </TableHead>
            <TableHead className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Tipo
            </TableHead>
            <TableHead className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Variantes
            </TableHead>
            <TableHead className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Stock
            </TableHead>
            <TableHead className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Desde
            </TableHead>
            <TableHead className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Estado
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((p) => (
            <TableRow key={p.id} className="cursor-pointer">
              <TableCell>
                <Link href={`/app/${tenantSlug}/products/${p.id}`} className="block">
                  <div className="relative h-10 w-10 overflow-hidden rounded-md border border-border bg-muted">
                    {p.primary_image_url ? (
                      <Image
                        src={p.primary_image_url}
                        alt=""
                        fill
                        sizes="40px"
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <ImageOff className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      </div>
                    )}
                  </div>
                </Link>
              </TableCell>
              <TableCell className="max-w-xs">
                <Link href={`/app/${tenantSlug}/products/${p.id}`} className="block">
                  <div className="font-display text-sm font-bold text-foreground">{p.name}</div>
                  <div className="font-mono text-xs text-muted-foreground">{p.sku ?? p.slug}</div>
                </Link>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{p.type_name ?? "—"}</TableCell>
              <TableCell className="font-mono text-sm">{p.variant_count}</TableCell>
              <TableCell className="font-mono text-sm">{p.total_stock}</TableCell>
              <TableCell className="font-mono text-sm">
                {p.min_price !== null ? p.min_price.toLocaleString("es-AR", { maximumFractionDigits: 2 }) : "—"}
              </TableCell>
              <TableCell>
                <Badge variant={STATUS_VARIANT[p.status]}>{STATUS_LABEL[p.status]}</Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
