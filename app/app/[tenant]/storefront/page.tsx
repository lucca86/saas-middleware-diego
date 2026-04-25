import { requireTenant } from "@/lib/tenant/context"
import { createClient } from "@/lib/supabase/server"
import type { StorefrontConfig } from "@/lib/storefront/types"
import { StorefrontAdmin } from "@/components/storefront/storefront-admin"

export const metadata = {
  title: "Storefront",
}

export default async function StorefrontAdminPage({
  params,
}: {
  params: Promise<{ tenant: string }>
}) {
  const { tenant: slug } = await params
  const { tenant, role } = await requireTenant(slug)
  const supabase = await createClient()

  const { data } = await supabase
    .from("tenants")
    .select("storefront_config, is_storefront_published")
    .eq("id", tenant.id)
    .maybeSingle()

  const { count } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenant.id)
    .eq("status", "active")

  const config = ((data?.storefront_config ?? {}) as StorefrontConfig) || {}
  const published = data?.is_storefront_published ?? false

  return (
    <StorefrontAdmin
      tenantSlug={slug}
      tenantName={tenant.name}
      published={published}
      activeProductCount={count ?? 0}
      config={config}
      readonly={role !== "owner" && role !== "admin"}
    />
  )
}
