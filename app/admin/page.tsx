import Link from "next/link"
import { Building2, Package, ShieldCheck, Users } from "lucide-react"
import { platformStats } from "@/lib/platform/queries"
import { Card, CardContent } from "@/components/ui/card"

export default async function AdminHomePage() {
  const stats = await platformStats()

  const cards = [
    { label: "Tenants", value: stats.tenants, icon: Building2, href: "/admin/tenants" },
    { label: "Usuarios", value: stats.users, icon: Users, href: "/admin/users" },
    { label: "Productos", value: stats.products, icon: Package },
    { label: "Variantes", value: stats.variants, icon: Package },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Resumen de la plataforma</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Vista global de todos los tenants y usuarios del sistema. Sólo los administradores de
          plataforma ven esta sección.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon
          const inner = (
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {c.label}
                </div>
                <div className="mt-2 font-display text-3xl font-bold tabular-nums">{c.value}</div>
              </div>
              <Icon className="h-6 w-6 text-muted-foreground" aria-hidden />
            </CardContent>
          )
          return c.href ? (
            <Link key={c.label} href={c.href}>
              <Card className="transition-colors hover:border-primary/40">{inner}</Card>
            </Link>
          ) : (
            <Card key={c.label}>{inner}</Card>
          )
        })}
      </div>

      <Card>
        <CardContent className="space-y-3 p-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" aria-hidden />
            <h2 className="font-display text-base font-semibold">¿Qué puedo hacer aquí?</h2>
          </div>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            <li>· Ver y gestionar todos los <Link href="/admin/tenants" className="text-primary hover:underline">tenants</Link> del sistema.</li>
            <li>· Crear <Link href="/admin/users" className="text-primary hover:underline">usuarios de prueba</Link> con cualquier rol y asignarlos a un tenant.</li>
            <li>· Promover otros usuarios a administradores de plataforma.</li>
            <li>· Quitar membresías o eliminar usuarios.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
