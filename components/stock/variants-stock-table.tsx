"use client"

import { useMemo, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { History, Pencil, Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { StockMovementDialog } from "./stock-movement-dialog"
import { variantLabel, type VariantStockRow } from "@/lib/stock/types"

interface Props {
  tenantSlug: string
  variants: VariantStockRow[]
  canEdit: boolean
}

type StockFilter = "all" | "out" | "low" | "ok"

export function VariantsStockTable({ tenantSlug, variants, canEdit }: Props) {
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<StockFilter>("all")
  const [active, setActive] = useState<VariantStockRow | null>(null)

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    return variants
      .filter((v) => v.status === "active")
      .filter((v) => {
        if (filter === "out" && v.stock > 0) return false
        if (filter === "low" && (v.stock <= 0 || v.stock > 3)) return false
        if (filter === "ok" && v.stock <= 3) return false
        if (s.length === 0) return true
        const haystack = [
          v.product_name,
          v.variant_sku,
          ...Object.values(v.variant_attributes ?? {}),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
        return haystack.includes(s)
      })
  }, [variants, search, filter])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por producto, SKU o atributo"
            className="h-9 pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={filter} onValueChange={(v) => setFilter(v as StockFilter)}>
          <SelectTrigger className="h-9 w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las variantes</SelectItem>
            <SelectItem value="out">Sin stock</SelectItem>
            <SelectItem value="low">Stock bajo (≤ 3)</SelectItem>
            <SelectItem value="ok">Con stock</SelectItem>
          </SelectContent>
        </Select>
        <span className="ml-auto font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          {filtered.length} variantes
        </span>
      </div>

      {filtered.length === 0 ? (
        <Empty className="border border-dashed border-border bg-card/40">
          <EmptyMedia>
            <Search className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>Sin resultados</EmptyTitle>
          <EmptyDescription>
            No hay variantes activas que coincidan con los filtros.
          </EmptyDescription>
        </Empty>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Producto
                </TableHead>
                <TableHead className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Variante
                </TableHead>
                <TableHead className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  SKU
                </TableHead>
                <TableHead className="text-right font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Stock
                </TableHead>
                <TableHead className="text-right font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Acciones
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((v) => {
                const stockBadge =
                  v.stock <= 0 ? (
                    <Badge variant="destructive" className="font-mono">
                      0
                    </Badge>
                  ) : v.stock <= 3 ? (
                    <Badge variant="outline" className="font-mono">
                      {v.stock}
                    </Badge>
                  ) : (
                    <span className="font-mono">{v.stock}</span>
                  )

                return (
                  <TableRow key={v.variant_id}>
                    <TableCell>
                      {v.primary_image_url ? (
                        <div className="h-10 w-10 overflow-hidden rounded bg-muted">
                          <Image
                            src={v.primary_image_url}
                            alt=""
                            width={40}
                            height={40}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="h-10 w-10 rounded bg-muted" />
                      )}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/app/${tenantSlug}/products/${v.product_id}`}
                        className="text-sm font-medium hover:underline"
                      >
                        {v.product_name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {variantLabel(v.variant_attributes)}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {v.variant_sku ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">{stockBadge}</TableCell>
                    <TableCell className="text-right">
                      {canEdit ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setActive(v)}
                        >
                          <Pencil className="mr-1.5 h-3.5 w-3.5" />
                          Movimiento
                        </Button>
                      ) : (
                        <Button
                          asChild
                          type="button"
                          variant="ghost"
                          size="sm"
                          aria-label="Ver historial"
                        >
                          <Link href={`/app/${tenantSlug}/stock?variant=${v.variant_id}`}>
                            <History className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {active ? (
        <StockMovementDialog
          tenantSlug={tenantSlug}
          open={!!active}
          onOpenChange={(o) => {
            if (!o) setActive(null)
          }}
          variant={{
            id: active.variant_id,
            sku: active.variant_sku,
            attributes: active.variant_attributes,
            stock: active.stock,
            productName: active.product_name,
          }}
        />
      ) : null}
    </div>
  )
}
