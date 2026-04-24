import { requireTenant } from "@/lib/tenant/context"
import { AppSidebar } from "@/components/app/app-sidebar"
import { AppTopbar } from "@/components/app/app-topbar"

export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ tenant: string }>
}) {
  const { tenant: tenantSlug } = await params
  const tenant = await requireTenant(tenantSlug)

  return (
    <div className="flex h-screen bg-background text-foreground">
      <AppSidebar tenantSlug={tenant.slug} tenantName={tenant.name} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AppTopbar />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
