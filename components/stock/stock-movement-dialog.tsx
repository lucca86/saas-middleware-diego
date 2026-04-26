"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ArrowDownToLine, ArrowUpFromLine, Equal } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Spinner } from "@/components/ui/spinner"
import { recordStockMovement } from "@/app/app/[tenant]/stock/actions"
import { STOCK_MOVEMENT_REASONS, variantLabel } from "@/lib/stock/types"

interface Props {
  tenantSlug: string
  open: boolean
  onOpenChange: (open: boolean) => void
  variant: {
    id: string
    sku: string | null
    attributes: Record<string, string>
    stock: number
    productName: string
  }
  /** Called after a successful movement with the new stock level. */
  onSuccess?: (newStock: number) => void
}

type MovementTab = "in" | "out" | "adjustment"

export function StockMovementDialog({ tenantSlug, open, onOpenChange, variant, onSuccess }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<MovementTab>("in")
  const [qty, setQty] = useState("1")
  const [target, setTarget] = useState(String(variant.stock))
  const [reason, setReason] = useState(STOCK_MOVEMENT_REASONS.in[0])
  const [notes, setNotes] = useState("")
  const [reference, setReference] = useState("")
  const [pending, startTransition] = useTransition()

  // Reset form whenever a new variant is opened
  useEffect(() => {
    if (open) {
      setTab("in")
      setQty("1")
      setTarget(String(variant.stock))
      setReason(STOCK_MOVEMENT_REASONS.in[0])
      setNotes("")
      setReference("")
    }
  }, [open, variant.id, variant.stock])

  // Default reason updates when the tab changes
  useEffect(() => {
    setReason(STOCK_MOVEMENT_REASONS[tab][0])
  }, [tab])

  function submit() {
    startTransition(async () => {
      const payload =
        tab === "adjustment"
          ? {
              variantId: variant.id,
              type: "adjustment" as const,
              targetStock: Number(target),
              reason,
              notes: notes || null,
              reference: reference || null,
            }
          : {
              variantId: variant.id,
              type: tab,
              qty: Number(qty),
              reason,
              notes: notes || null,
              reference: reference || null,
            }

      const res = await recordStockMovement(tenantSlug, payload)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(`Stock actualizado: ${res.newStock}`)
      onSuccess?.(res.newStock)
      onOpenChange(false)
      router.refresh()
    })
  }

  const delta =
    tab === "adjustment"
      ? Number(target) - variant.stock
      : tab === "in"
        ? Number(qty)
        : -Number(qty)

  const projected = variant.stock + (Number.isFinite(delta) ? delta : 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar movimiento</DialogTitle>
          <DialogDescription>
            <span className="font-medium text-foreground">{variant.productName}</span>
            <span className="text-muted-foreground"> · {variantLabel(variant.attributes)}</span>
            {variant.sku ? (
              <span className="ml-1 font-mono text-xs text-muted-foreground">({variant.sku})</span>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-border bg-card/50 px-3 py-2 text-sm">
          <span className="text-muted-foreground">Stock actual: </span>
          <span className="font-mono font-semibold">{variant.stock}</span>
          {Number.isFinite(delta) && delta !== 0 ? (
            <>
              <span className="mx-2 text-muted-foreground">→</span>
              <span
                className={`font-mono font-semibold ${
                  projected < 0
                    ? "text-destructive"
                    : projected === 0
                      ? "text-muted-foreground"
                      : "text-foreground"
                }`}
              >
                {projected}
              </span>
              <span className="ml-2 text-xs text-muted-foreground">
                ({delta > 0 ? "+" : ""}
                {delta})
              </span>
            </>
          ) : null}
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as MovementTab)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="in">
              <ArrowDownToLine className="mr-1 h-3.5 w-3.5" />
              Entrada
            </TabsTrigger>
            <TabsTrigger value="out">
              <ArrowUpFromLine className="mr-1 h-3.5 w-3.5" />
              Salida
            </TabsTrigger>
            <TabsTrigger value="adjustment">
              <Equal className="mr-1 h-3.5 w-3.5" />
              Ajuste
            </TabsTrigger>
          </TabsList>

          <TabsContent value="in" className="mt-4 space-y-3">
            <div>
              <Label htmlFor="qty-in">Cantidad</Label>
              <Input
                id="qty-in"
                type="number"
                min={1}
                step={1}
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
            </div>
          </TabsContent>

          <TabsContent value="out" className="mt-4 space-y-3">
            <div>
              <Label htmlFor="qty-out">Cantidad</Label>
              <Input
                id="qty-out"
                type="number"
                min={1}
                step={1}
                max={variant.stock}
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
              {Number(qty) > variant.stock ? (
                <p className="mt-1 text-xs text-destructive">No hay tanto stock disponible.</p>
              ) : null}
            </div>
          </TabsContent>

          <TabsContent value="adjustment" className="mt-4 space-y-3">
            <div>
              <Label htmlFor="target">Stock objetivo</Label>
              <Input
                id="target"
                type="number"
                min={0}
                step={1}
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Se registrará un ajuste de {delta > 0 ? "+" : ""}
                {delta} unidad{Math.abs(delta) === 1 ? "" : "es"}.
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <div className="space-y-3">
          <div>
            <Label htmlFor="reason">Motivo</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger id="reason">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STOCK_MOVEMENT_REASONS[tab].map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="reference">Referencia (opcional)</Label>
            <Input
              id="reference"
              placeholder="Nro. de factura, remito, etc."
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="notes">Notas (opcional)</Label>
            <Textarea
              id="notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detalles del movimiento"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button
            onClick={submit}
            disabled={
              pending ||
              (tab === "out" && (Number(qty) <= 0 || Number(qty) > variant.stock)) ||
              (tab === "in" && Number(qty) <= 0) ||
              (tab === "adjustment" && (Number(target) === variant.stock || Number(target) < 0))
            }
          >
            {pending ? <Spinner className="mr-2 h-4 w-4" /> : null}
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
