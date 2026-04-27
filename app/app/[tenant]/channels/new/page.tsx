import Link from "next/link"
import { ArrowLeft, ShoppingBag, Lock, AlertCircle } from "lucide-react"
import { requireTenant } from "@/lib/tenant/context"
import { tiendaNubeIsConfigured } from "@/lib/channels/tiendanube"
import { startTiendaNubeConnect } from "../actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface ProviderOption {
  id: "tiendanube" | "mercadolibre" | "shopify"
  name: string
  description: string
  status: "available" | "soon"
}

const PROVIDERS: ProviderOption[] = [
  {
    id: "tiendanube",
    name: "Tienda Nube",
    description:
      "Sincroniza catálogo y stock con tu Tiendanube. Conexión vía OAuth: nunca pedimos tu contraseña.",
    status: "available",
  },
  {
    id: "mercadolibre",
    name: "Mercado Libre",
    description: "Publicaciones y stock en MercadoLibre. Próximamente.",
    status: "soon",
  },
  {
    id: "shopify",
    name: "Shopify",
    description: "Sincronización con stores de Shopify. Próximamente.",
    status: "soon",
  },
]

export default async function NewChannelPage({
  params,
}: {
  params: Promise<{ tenant: string }>
}) {
  const { tenant: slug } = await params
  await requireTenant(slug)
  const tnReady = tiendaNubeIsConfigured()

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6">
      <Link
        href={`/app/${slug}/channels`}
        className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" />
        Volver a nodes
      </Link>
      <header>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Deploy new node
        </p>
        <h1 className="font-display text-3xl font-bold text-foreground">Elegí un canal</h1>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">
          Cada provider expone sus productos y stock por OAuth. Cuando conectás un node, las credenciales
          quedan guardadas y firmadas en tu tenant — sólo este tenant puede usarlas.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {PROVIDERS.map((p) => (
          <Card key={p.id} className={p.status === "available" ? "card-accent-primary" : ""}>
            <CardHeader className="space-y-2 pb-3">
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
                  <ShoppingBag className="h-5 w-5 text-foreground" aria-hidden />
                </div>
                {p.status === "soon" ? (
                  <Badge variant="outline" className="text-[10px]">
                    Próximamente
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-tertiary/30 bg-tertiary/15 text-tertiary text-[10px]">
                    Disponible
                  </Badge>
                )}
              </div>
              <CardTitle>{p.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>{p.description}</p>

              {p.id === "tiendanube" ? (
                tnReady ? (
                  <>
                    <div className="rounded-md border border-border/60 bg-muted/40 p-3 text-xs">
                      <p className="font-medium text-foreground">Necesitás tu cuenta de Tienda Nube.</p>
                      <p className="mt-1 text-muted-foreground">
                        Vas a iniciar sesión con el email/password con el que entrás al admin de tu tienda en{" "}
                        <span className="font-mono">mitiendanube.com/admin</span>. <strong>No</strong> uses tus
                        credenciales de Stockcurve.
                      </p>
                      <p className="mt-2 text-muted-foreground">
                        ¿No tenés tienda?{" "}
                        <a
                          href="https://www.tiendanube.com/crear-tienda-online"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline underline-offset-2"
                        >
                          Creá una gratis acá
                        </a>{" "}
                        y volvé.
                      </p>
                    </div>
                    <form
                      action={async () => {
                        "use server"
                        await startTiendaNubeConnect(slug)
                      }}
                    >
                      <Button type="submit" className="w-full shadow-signal">
                        <Lock className="mr-1.5 h-4 w-4" />
                        Conectar con Tienda Nube
                      </Button>
                    </form>
                  </>
                ) : (
                  <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5" />
                    <span>
                      Faltan TIENDANUBE_APP_ID y TIENDANUBE_CLIENT_SECRET. Pedile a un platform admin que las cargue.
                    </span>
                  </div>
                )
              ) : (
                <Button disabled variant="outline" className="w-full bg-transparent">
                  Próximamente
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="space-y-2 p-4 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">¿Qué pasa al conectar?</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>
              Te redirigimos al sitio del <strong className="text-foreground">provider</strong> (ej.
              tiendanube.com) para que <strong className="text-foreground">vos</strong> inicies sesión con tu
              cuenta de esa plataforma.
            </li>
            <li>Aprobás la instalación de la app en tu tienda.</li>
            <li>El provider nos devuelve un access token (no tu contraseña).</li>
            <li>Pedimos los datos básicos de tu tienda y los guardamos atados al tenant.</li>
            <li>Volvés acá con el node activo, listo para sincronizar.</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  )
}
