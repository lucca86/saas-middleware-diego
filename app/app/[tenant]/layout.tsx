import {
  getCurrentUserProfile,
  listUserTenants,
  requireTenant,
} from "@/lib/tenant/context"
import { isPlatformAdmin } from "@/lib/platform/auth"
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
  const [{ tenant, role }, tenants, profile, platformAdmin] = await Promise.all([
    requireTenant(tenantSlug),
    listUserTenants(),
    getCurrentUserProfile(),
    isPlatformAdmin(),
  ])

  const current = {
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    plan: tenant.plan,
    role,
  }

  return (
    <div className="flex h-screen bg-background text-foreground">
      <AppSidebar current={current} tenants={tenants} isPlatformAdmin={platformAdmin} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AppTopbar
          tenantSlug={tenant.slug}
          fullName={profile?.full_name ?? null}
          email={profile?.email ?? null}
          avatarUrl={profile?.avatar_url ?? null}
        />
        <main className="flex-1 overflow-y-auto px-8 py-8">{children}</main>
      </div>
    </div>
  )
}
