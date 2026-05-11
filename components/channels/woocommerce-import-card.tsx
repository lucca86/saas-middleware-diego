"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Download, AlertTriangle, CheckCircle2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { importWooCommerce } from "@/app/app/[tenant]/channels/actions"

interface ImportSummary {
  productsImported: number
  productsSkipped: number
  variantsCreated: number
  imagesUploaded: number
  imagesFailed: number
  errors: string[]
}

/**
 * Detail-page card that triggers the one-shot WooCommerce import. Once an
 * import has already run (`lastImportAt` truthy) we show a strong warning
 * because re-running pisaría stock/precios que el tenant pudo editar
 * localmente. The user has to explicitly opt-in with `force=true`.
 */
export function WooCommerceImportCard({
  tenantSlug,
  channelId,
  canManage,
  lastImportAt,
  lastImportSummary,
}: {
  tenantSlug: string
  channelId: string
  canManage: boolean
  lastImportAt: string | null
  lastImportSummary: ImportSummary | null
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [result, setResult] = useState<ImportSummary | null>(lastImportSummary)

  function trigger(force: boolean) {
    start(async () => {
      const res = await importWooCommerce(tenantSlug, channelId, { force })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      setResult(res.summary)
      toast.success(
        `Import completo: ${res.summary.productsImported} productos, ${res.summary.variantsCreated} variantes.`,
      )
      router.refresh()
    })
  }

  const alreadyImported = Boolean(lastImportAt)

  return (
    <Card className={alreadyImported ? "" : "card-accent-primary"}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Importación inicial</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {alreadyImported ? (
          <div className="rounded-md border border-tertiary/30 bg-tertiary/5 p-3 text-xs text-tertiary">
            <div className="flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Importado el{" "}
              {new Date(lastImportAt!).toLocaleString("es-AR", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </div>
            {result ? (
              <ul className="mt-2 space-y-0.5 font-mono">
                <li>Productos: {result.productsImported} importados, {result.productsSkipped} omitidos</li>
                <li>Variantes creadas: {result.variantsCreated}</li>
                <li>
                  Imágenes: {result.imagesUploaded} subidas
                  {result.imagesFailed > 0 ? `, ${result.imagesFailed} fallaron` : ""}
                </li>
              </ul>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Traé todo el catálogo de WooCommerce a este tenant: productos, variantes, precios,
            stock e imágenes. La importación es <strong className="text-foreground">una sola vez</strong>;
            después Stockcurve es la fuente de verdad.
          </p>
        )}

        {result && result.errors.length > 0 ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
            <div className="flex items-center gap-1.5 font-medium">
              <AlertTriangle className="h-3.5 w-3.5" />
              Errores ({result.errors.length})
            </div>
            <ul className="mt-2 max-h-32 list-disc space-y-0.5 overflow-y-auto pl-5 font-mono">
              {result.errors.slice(0, 20).map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {!canManage ? (
          <p className="text-xs text-muted-foreground">
            Solo owner o admin pueden ejecutar la importación.
          </p>
        ) : !alreadyImported ? (
          <Button
            type="button"
            className="shadow-signal"
            onClick={() => trigger(false)}
            disabled={pending}
          >
            <Download className="mr-1.5 h-4 w-4" />
            {pending ? "Importando…" : "Importar ahora"}
          </Button>
        ) : (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                className="bg-transparent"
              >
                <Download className="mr-1.5 h-4 w-4" />
                Re-importar (pisa cambios)
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Volver a importar desde WooCommerce?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esto va a actualizar precios, stock, descripciones e imágenes de todos los
                  productos importados originalmente. Cualquier cambio que hayas hecho en
                  Stockcurve se va a pisar. <strong>Esta operación no se puede deshacer.</strong>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => trigger(true)}>
                  Sí, re-importar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </CardContent>
    </Card>
  )
}
