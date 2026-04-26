"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ArrowDownToLine, ArrowUpFromLine, Equal, Sparkles } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import {
  STOCK_MOVEMENT_LABELS,
  variantLabel,
  type StockMovementType,
  type StockMovementWithContext,
} from "@/lib/stock/types"

interface Props {
  tenantSlug: string
  movements: StockMovementWithContext[]
}

const TYPE_ICONS: Record<StockMovementType, typeof ArrowDownToLine> = {
  initial: Sparkles,
  in: ArrowDownToLine,
  out: ArrowUpFromLine,
  adjustment: Equal,
}

const TYPE_VARIANTS: Record<StockMovementType, "default" | "destructive" | "outline" | "secondary"> = {
  initial: "secondary",
  in: "default",
  out: "destructive",
  adjustment: "outline",
}

export function StockMovementsLog({ tenantSlug, movements }: Props) {
  const [typeFilter, setTypeFilter] = useState<StockMovementType | "all">("all")
  const [search, setSearch] = useState("")

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    return movements.filter((m) => {
      if (typeFilter !== "all" && m.type !== typeFilter) return false
      if (s.length === 0) return true
      const haystack = [
        m.product_name,
        m.variant_sku,
        m.reason,
        m.notes,
        m.reference,
        ...Object.values(m.variant_attributes ?? {}),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return haystack.includes(s)
    })
  }, [movements, typeFilter, search])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Buscar por producto, SKU, motivo o referencia"
          className="h-9 max-w-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
          <SelectTrigger className="h-9 w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            <SelectItem value="in">Entradas</SelectItem>
            <SelectItem value="out">Salidas</SelectItem>
            <SelectItem value="adjustment">Ajustes</SelectItem>
            <SelectItem value="initial">Stock inicial</SelectItem>
          </SelectContent>
        </Select>
        <span className="ml-auto font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          {filtered.length} de {movements.length}
        </span>
      </div>

      {filtered.length === 0 ? (
        <Empty className="border border-dashed border-border bg-card/40">
          <EmptyMedia>
            <ArrowDownToLine className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>Sin movimientos</EmptyTitle>
          <EmptyDescription>
            {movements.length === 0
              ? "Todavía no se registraron movimientos de stock. Cargá entradas desde la matriz de variantes o desde esta página."
              : "Ningún movimiento coincide con los filtros aplicados."}
          </EmptyDescription>
        </Empty>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Fecha
                </TableHead>
                <TableHead className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Tipo
                </TableHead>
                <TableHead className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Producto / Variante
                </TableHead>
                <TableHead className="text-right font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Cantidad
                </TableHead>
                <TableHead className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Motivo
                </TableHead>
                <TableHead className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Referencia
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((m) => {
                const Icon = TYPE_ICONS[m.type]
                return (
                  <TableRow key={m.id}>
                    <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                      {formatDate(m.created_at)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={TYPE_VARIANTS[m.type]} className="gap-1">
                        <Icon className="h-3 w-3" aria-hidden="true" />
                        {STOCK_MOVEMENT_LABELS[m.type]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        {m.product_slug ? (
                          <Link
                            href={`/app/${tenantSlug}/products/${m.product_id}`}
                            className="text-sm font-medium hover:underline"
                          >
                            {m.product_name ?? "—"}
                          </Link>
                        ) : (
                          <span className="text-sm font-medium">{m.product_name ?? "—"}</span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {variantLabel(m.variant_attributes)}
                          {m.variant_sku ? (
                            <span className="ml-2 font-mono">({m.variant_sku})</span>
                          ) : null}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      <span
                        className={
                          m.qty > 0 ? "text-foreground" : "text-destructive"
                        }
                      >
                        {m.qty > 0 ? "+" : ""}
                        {m.qty}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {m.reason ?? "—"}
                      {m.notes ? (
                        <div className="text-xs text-muted-foreground/80">{m.notes}</div>
                      ) : null}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {m.reference ?? "—"}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}
