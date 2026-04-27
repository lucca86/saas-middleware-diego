import { redirect } from "next/navigation"

/**
 * `/app/<slug>` is an alias of `/app/<slug>/dashboard`. The tenant layout
 * already validates membership and resolves the tenant, so this index page
 * just bounces to the dashboard. Without this file the URL hits the 404
 * boundary because no other route segment matches.
 */
export default async function TenantIndex({
  params,
}: {
  params: Promise<{ tenant: string }>
}) {
  const { tenant } = await params
  redirect(`/app/${tenant}/dashboard`)
}
