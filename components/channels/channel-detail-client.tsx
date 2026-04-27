"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { CheckCircle2, Power, Trash2, Zap } from "lucide-react"
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
import {
  deleteChannel,
  disconnectChannel,
  testChannelConnection,
} from "@/app/app/[tenant]/channels/actions"

export function ChannelDetailClient({
  tenantSlug,
  channelId,
  canManage,
  status,
}: {
  tenantSlug: string
  channelId: string
  canManage: boolean
  status: string
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [lastTest, setLastTest] = useState<{ ok: boolean; message: string } | null>(null)

  function handleTest() {
    start(async () => {
      const res = await testChannelConnection(tenantSlug, channelId)
      if (res.ok) {
        setLastTest({ ok: true, message: "Conexión OK. Datos de la tienda actualizados." })
        toast.success("Conexión verificada")
        router.refresh()
      } else {
        setLastTest({ ok: false, message: res.error })
        toast.error(res.error)
      }
    })
  }

  function handleDisconnect() {
    start(async () => {
      const res = await disconnectChannel(tenantSlug, channelId)
      if (res.ok) {
        toast.success("Canal desconectado")
        router.refresh()
      } else {
        toast.error(res.error)
      }
    })
  }

  function handleDelete() {
    start(async () => {
      const res = await deleteChannel(tenantSlug, channelId)
      if (res.ok) {
        toast.success("Canal eliminado")
        router.push(`/app/${tenantSlug}/channels`)
      } else {
        toast.error(res.error)
      }
    })
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Acciones</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleTest}
            disabled={pending || status === "disconnected"}
          >
            <Zap className="mr-1.5 h-4 w-4" />
            Probar conexión
          </Button>

          {canManage && status !== "disconnected" ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="outline" size="sm" disabled={pending}>
                  <Power className="mr-1.5 h-4 w-4" />
                  Desconectar
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Desconectar este canal?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Vamos a borrar el access token guardado. La tienda no se sincronizará
                    hasta que vuelvas a conectarla. Los datos del catálogo no se eliminan.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDisconnect}>Desconectar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : null}

          {canManage ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive bg-transparent"
                  disabled={pending}
                >
                  <Trash2 className="mr-1.5 h-4 w-4" />
                  Eliminar
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Eliminar canal completamente</AlertDialogTitle>
                  <AlertDialogDescription>
                    Se borra el registro de este node. Para volver a usarlo vas a tener
                    que reinstalar la app desde Tienda Nube.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Eliminar definitivamente
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : null}
        </div>

        {lastTest ? (
          <div
            className={`flex items-start gap-2 rounded-md border p-3 text-xs ${
              lastTest.ok
                ? "border-tertiary/30 bg-tertiary/5 text-tertiary"
                : "border-destructive/30 bg-destructive/5 text-destructive"
            }`}
          >
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5" />
            <span>{lastTest.message}</span>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
