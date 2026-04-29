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
          current={current}
          tenants={tenants}
          isPlatformAdmin={platformAdmin}
          fullName={profile?.full_name ?? null}
          email={profile?.email ?? null}
          avatarUrl={profile?.avatar_url ?? null}
        />
        {/* Reduced padding on mobile so content gets real estate; desktop keeps
            the original 8-unit padding. */}
        <main className="flex-1 overflow-y-auto px-4 py-5 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  )
}
