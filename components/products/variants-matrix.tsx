"use client"

import { Archive, RotateCcw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty"
import type { AttributeDef } from "@/lib/products/types"

export interface VariantRow {
  id?: string
  attributes: Record<string, string>
  sku: string
  price: string
  stock: string
  status: "active" | "archived"
  isNew?: boolean
}

interface Props {
  variantAttrs: AttributeDef[]
  variants: VariantRow[]
  onChange: (rows: VariantRow[]) => void
  currency: string
  readonly?: boolean
}

export function VariantsMatrix({ variantAttrs, variants, onChange, currency, readonly }: Props) {
  function update(idx: number, patch: Partial<VariantRow>) {
    onChange(variants.map((v, i) => (i === idx ? { ...v, ...patch } : v)))
  }

  function bulkPrice(value: string) {
    onChange(variants.map((v) => ({ ...v, price: value })))
  }

  function bulkStock(value: string) {
    onChange(variants.map((v) => ({ ...v, stock: value })))
  }

  function toggleStatus(idx: number) {
    const v = variants[idx]
    update(idx, { status: v.status === "active" ? "archived" : "active" })
  }

  if (variants.length === 0) {
    return (
      <Empty className="border border-dashed border-border bg-card/40">
        <EmptyTitle>Sin variantes</EmptyTitle>
        <EmptyDescription>
          Elegí un tipo de producto con atributos de variante o agregá opciones para generar la grilla.
        </EmptyDescription>
      </Empty>
    )
  }

  const isSimple = variantAttrs.length === 0
  const newCount = variants.filter((v) => v.isNew).length

  return (
    <div className="flex flex-col gap-3">
      {newCount > 0 ? (
        <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-foreground">
          <Badge variant="default">{newCount}</Badge>
          <span>variantes nuevas se crearán al guardar.</span>
        </div>
      ) : null}

      {!readonly ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-card/40 p-3">
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Aplicar a todas</span>
          <Input
            type="number"
            placeholder="Precio"
            className="h-8 w-28"
            min={0}
            step="0.01"
            onChange={(e) => bulkPrice(e.target.value)}
          />
          <Input
            type="number"
            placeholder="Stock"
            className="h-8 w-24"
            min={0}
            step={1}
            onChange={(e) => bulkStock(e.target.value)}
          />
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border">
              {!isSimple ? (
                variantAttrs.map((a) => (
                  <th
                    key={a.key}
                    className="px-3 py-2 text-left font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground"
                  >
                    {a.label}
                  </th>
                ))
              ) : (
                <th className="px-3 py-2 text-left font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Variante
                </th>
              )}
              <th className="px-3 py-2 text-left font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                SKU
              </th>
              <th className="px-3 py-2 text-left font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Precio ({currency})
              </th>
              <th className="px-3 py-2 text-left font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Stock
              </th>
              <th className="px-3 py-2 text-right font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Estado
              </th>
            </tr>
          </thead>
          <tbody>
            {variants.map((v, idx) => {
              const archived = v.status === "archived"
              return (
                <tr
                  key={Object.values(v.attributes).join("·") + idx}
                  className={archived ? "border-b border-border opacity-60" : "border-b border-border"}
                >
                  {!isSimple ? (
                    variantAttrs.map((a) => (
                      <td key={a.key} className="px-3 py-2 font-mono text-xs">
                        {v.attributes[a.key] ?? "—"}
                      </td>
                    ))
                  ) : (
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">Default</td>
                  )}
                  <td className="px-2 py-1.5">
                    <Input
                      value={v.sku}
                      onChange={(e) => update(idx, { sku: e.target.value })}
                      placeholder="SKU-001"
                      className="h-8 w-32 font-mono text-xs"
                      disabled={readonly}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      type="number"
                      value={v.price}
                      onChange={(e) => update(idx, { price: e.target.value })}
                      className="h-8 w-24"
                      min={0}
                      step="0.01"
                      disabled={readonly}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      type="number"
                      value={v.stock}
                      onChange={(e) => update(idx, { stock: e.target.value })}
                      className="h-8 w-20"
                      min={0}
                      step={1}
                      disabled={readonly}
                    />
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    {!readonly ? (
                      <Button type="button" variant="ghost" size="sm" onClick={() => toggleStatus(idx)}>
                        {archived ? (
                          <>
                            <RotateCcw className="mr-1 h-3.5 w-3.5" /> Reactivar
                          </>
                        ) : (
                          <>
                            <Archive className="mr-1 h-3.5 w-3.5" /> Archivar
                          </>
                        )}
                      </Button>
                    ) : (
                      <Badge variant={archived ? "outline" : "default"}>{archived ? "Archivado" : "Activo"}</Badge>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">{variants.length} variantes en total.</p>
    </div>
  )
}
