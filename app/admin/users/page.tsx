import { listAllTenants, listAllUsers } from "@/lib/platform/queries"
import { requirePlatformAdmin } from "@/lib/platform/auth"
import { AdminUsersClient } from "@/components/admin/admin-users-client"

export default async function AdminUsersPage() {
  const [me, users, tenants] = await Promise.all([
    requirePlatformAdmin(),
    listAllUsers(),
    listAllTenants(),
  ])
  return (
    <AdminUsersClient
      users={users}
      currentUserId={me.id}
      tenants={tenants.map((t) => ({ id: t.id, slug: t.slug, name: t.name }))}
    />
  )
}
