import { listAllTenants } from "@/lib/platform/queries"
import { AdminTenantsClient } from "@/components/admin/admin-tenants-client"

export default async function AdminTenantsPage() {
  const tenants = await listAllTenants()
  return <AdminTenantsClient tenants={tenants} />
}
