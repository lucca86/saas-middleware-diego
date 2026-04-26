"use client"

import { useMemo, useRef, useState, useTransition } from "react"
import { AlertCircle, CheckCircle2, FileSpreadsheet, Upload } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  importProductsFromCsv,
  previewCsvImport,
  type ImportSummary,
} from "@/app/app/[tenant]/products/import/actions"
import type { ParsedProduct } from "@/lib/products/csv-import"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
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

const SAMPLE_CSV = `name,sku,category,status,tags,variant_sku,variant_price,variant_cost,variant_stock,attr_talle,attr_color
Remera básica,REM-001,Indumentaria,active,verano|unisex,REM-001-S-NEG,4500,2000,12,S,Negro
Remera básica,,,,,REM-001-M-NEG,4500,2000,8,M,Negro
Remera básica,,,,,REM-001-L-NEG,4500,2000,5,L,Negro
Buzo canguro,BUZ-001,Indumentaria,draft,invierno,BUZ-001-M-GRI,12500,6000,4,M,Gris
`

type Stage = "idle" | "preview" | "imported"

export function ProductsImportClient({ tenantSlug }: { tenantSlug: string }) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [delimiter, setDelimiter] = useState<"," | ";" | "\t">(",")
  const [csvText, setCsvText] = useState<string>("")
  const [fileName, setFileName] = useState<string>("")
  const [preview, setPreview] = useState<{
    products: ParsedProduct[]
    errors: Array<{ line: number; message: string }>
    totalRows: number
  } | null>(null)
  const [summary, setSummary] = useState<ImportSummary | null>(null)
  const [stage, setStage] = useState<Stage>("idle")
  const [pending, start] = useTransition()

  function reset() {
    setCsvText("")
    setFileName("")
    setPreview(null)
    setSummary(null)
    setStage("idle")
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  async function handleFile(file: File) {
    const text = await file.text()
    setCsvText(text)
    setFileName(file.name)
    start(async () => {
      const result = await previewCsvImport(text, delimiter)
      setPreview(result)
      setStage("preview")
    })
  }

  function handleDelimiterChange(v: "," | ";" | "\t") {
    setDelimiter(v)
    if (csvText) {
      start(async () => {
        const result = await previewCsvImport(csvText, v)
        setPreview(result)
      })
    }
  }

  function handleDownloadSample() {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "stockcurve-import-sample.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleImport() {
    if (!csvText) return
    start(async () => {
      const res = await importProductsFromCsv(tenantSlug, csvText, delimiter)
      setSummary(res)
      setStage("imported")
      if (res.ok) {
        toast.success(
          `${res.productsCreated} producto${res.productsCreated === 1 ? "" : "s"} importado${
            res.productsCreated === 1 ? "" : "s"
          }`,
        )
        router.refresh()
      } else if (res.error) {
        toast.error(res.error)
      }
    })
  }

  const totalVariants = useMemo(
    () => preview?.products.reduce((acc, p) => acc + p.variants.length, 0) ?? 0,
    [preview],
  )

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-5 p-5">
          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="space-y-2">
              <Label htmlFor="csv-file">Archivo CSV</Label>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  ref={fileInputRef}
                  id="csv-file"
                  type="file"
                  accept=".csv,text/csv"
                  className="block text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-xs file:font-medium file:text-primary-foreground hover:file:opacity-90"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) handleFile(f)
                  }}
                />
                {fileName ? (
                  <span className="font-mono text-xs text-muted-foreground">{fileName}</span>
                ) : null}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Separador</Label>
              <Select value={delimiter} onValueChange={(v) => handleDelimiterChange(v as "," | ";" | "\t")}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value=",">Coma ( , )</SelectItem>
                  <SelectItem value=";">Punto y coma ( ; )</SelectItem>
                  <SelectItem value={"\t"}>Tabulación</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-md border border-dashed border-border bg-muted/30 px-4 py-3">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">¿No sabés qué columnas usar?</p>
                <p className="text-xs text-muted-foreground">
                  Descargá una plantilla de ejemplo con todas las columnas soportadas.
                </p>
              </div>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={handleDownloadSample}>
              Descargar ejemplo
            </Button>
          </div>
        </CardContent>
      </Card>

      {stage === "preview" && preview ? (
        <Card>
          <CardContent className="p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-semibold">Vista previa</h2>
                <p className="text-xs text-muted-foreground">
                  {preview.totalRows} filas · {preview.products.length} productos · {totalVariants}{" "}
                  variantes
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={reset} disabled={pending}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleImport}
                  disabled={pending || preview.products.length === 0}
                >
                  <Upload className="mr-1.5 h-4 w-4" />
                  {pending ? "Importando..." : `Importar ${preview.products.length} producto${preview.products.length === 1 ? "" : "s"}`}
                </Button>
              </div>
            </div>

            {preview.errors.length > 0 ? (
              <div className="mb-4 rounded-md border border-warning/30 bg-warning/5 p-3">
                <div className="mb-1 flex items-center gap-1.5 text-sm font-medium text-warning">
                  <AlertCircle className="h-4 w-4" /> {preview.errors.length} fila
                  {preview.errors.length === 1 ? "" : "s"} con problemas
                </div>
                <ul className="ml-1 space-y-0.5 text-xs text-muted-foreground">
                  {preview.errors.slice(0, 6).map((e, i) => (
                    <li key={i}>
                      Línea {e.line}: {e.message}
                    </li>
                  ))}
                  {preview.errors.length > 6 ? (
                    <li>… y {preview.errors.length - 6} más</li>
                  ) : null}
                </ul>
              </div>
            ) : null}

            <div className="overflow-hidden rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Variantes</TableHead>
                    <TableHead className="text-right">Stock total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.products.slice(0, 50).map((p) => {
                    const totalStock = p.variants.reduce((acc, v) => acc + v.stock, 0)
                    return (
                      <TableRow key={p.name}>
                        <TableCell>
                          <div className="font-medium text-foreground">{p.name}</div>
                          {p.sku ? (
                            <div className="font-mono text-[10px] text-muted-foreground">
                              SKU: {p.sku}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {p.category ?? "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={p.status === "active" ? "default" : "outline"}>
                            {p.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {p.variants.length}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{totalStock}</TableCell>
                      </TableRow>
                    )
                  })}
                  {preview.products.length > 50 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-2 text-center text-xs text-muted-foreground">
                        … y {preview.products.length - 50} productos más
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {stage === "imported" && summary ? (
        <Card>
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center gap-2">
              {summary.ok ? (
                <CheckCircle2 className="h-5 w-5 text-success" />
              ) : (
                <AlertCircle className="h-5 w-5 text-destructive" />
              )}
              <h2 className="font-display text-base font-semibold">
                {summary.ok ? "Importación completada" : "Importación con errores"}
              </h2>
            </div>
            <ul className="ml-5 list-disc text-sm text-muted-foreground">
              <li>
                <strong className="text-foreground">{summary.productsCreated}</strong> productos creados
              </li>
              <li>
                <strong className="text-foreground">{summary.variantsCreated}</strong> variantes creadas
              </li>
              <li>
                <strong className="text-foreground">{summary.initialMovements}</strong> movimientos de
                stock inicial registrados
              </li>
              {summary.errors.length > 0 ? (
                <li>
                  <strong className="text-destructive">{summary.errors.length}</strong> error
                  {summary.errors.length === 1 ? "" : "es"}
                </li>
              ) : null}
            </ul>
            {summary.errors.length > 0 ? (
              <details className="rounded-md border border-border bg-muted/30 p-3">
                <summary className="cursor-pointer text-xs font-medium">Ver errores</summary>
                <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                  {summary.errors.map((e, i) => (
                    <li key={i}>
                      {e.line > 0 ? `Línea ${e.line}: ` : ""}
                      {e.message}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" size="sm" onClick={reset}>
                Importar otro CSV
              </Button>
              <Button asChild size="sm">
                <Link href={`/app/${tenantSlug}/products`}>Ver productos</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
