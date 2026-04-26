import Link from "next/link"
import { ArrowUpRight, ExternalLink } from "lucide-react"
import { listAllTenants } from "@/lib/platform/queries"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export default async function AdminTenantsPage() {
  const tenants = await listAllTenants()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Tenants</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {tenants.length} tenant{tenants.length === 1 ? "" : "s"} activos en la plataforma.
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenant</TableHead>
                <TableHead className="text-right">Miembros</TableHead>
                <TableHead className="text-right">Productos</TableHead>
                <TableHead>Storefront</TableHead>
                <TableHead>Creado</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <div className="font-medium text-foreground">{t.name}</div>
                    <div className="font-mono text-xs text-muted-foreground">/{t.slug}</div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{t.member_count}</TableCell>
                  <TableCell className="text-right tabular-nums">{t.product_count}</TableCell>
                  <TableCell>
                    {t.is_storefront_published ? (
                      <Badge className="bg-success/15 text-success border-success/30">Publicado</Badge>
                    ) : (
                      <Badge variant="outline">Borrador</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(t.created_at).toLocaleDateString("es-AR")}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/app/${t.slug}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                        title="Abrir como tenant"
                      >
                        <ArrowUpRight className="h-4 w-4" />
                      </Link>
                      {t.is_storefront_published ? (
                        <Link
                          href={`/s/${t.slug}`}
                          target="_blank"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                          title="Ver storefront público"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {tenants.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                    Todavía no hay tenants en la plataforma.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
