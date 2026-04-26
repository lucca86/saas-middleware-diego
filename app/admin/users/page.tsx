import { listAllTenants, listAllUsers } from "@/lib/platform/queries"
import { AdminUsersClient } from "@/components/admin/admin-users-client"

export default async function AdminUsersPage() {
  const [users, tenants] = await Promise.all([listAllUsers(), listAllTenants()])
  return (
    <AdminUsersClient
      users={users}
      tenants={tenants.map((t) => ({ id: t.id, slug: t.slug, name: t.name }))}
    />
  )
}
