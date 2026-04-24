import { createClient } from "@/lib/supabase/server"
import { requireTenant } from "@/lib/tenant/context"
import { MembersList } from "@/components/members/members-list"
import { InvitationsList } from "@/components/members/invitations-list"
import { InviteMemberButton } from "@/components/members/invite-member-button"

export const metadata = { title: "Miembros" }

export default async function MembersPage({
  params,
}: {
  params: Promise<{ tenant: string }>
}) {
  const { tenant: slug } = await params
  const { tenant, role } = await requireTenant(slug)
  const supabase = await createClient()

  const canManage = role === "owner" || role === "admin"

  const { data: members } = await supabase
    .from("tenant_members")
    .select(
      `
      id,
      role,
      created_at,
      user_id,
      profiles:profiles!inner (
        id,
        email,
        full_name,
        avatar_url
      )
    `,
    )
    .eq("tenant_id", tenant.id)
    .order("created_at", { ascending: true })

  const { data: invitations } = await supabase
    .from("tenant_invitations")
    .select("id, email, role, expires_at, accepted_at, created_at, token")
    .eq("tenant_id", tenant.id)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-extrabold tracking-tight text-foreground">
              Miembros del equipo
            </h2>
            <p className="text-sm text-muted-foreground">
              {members?.length ?? 0} miembro(s) activos en{" "}
              <span className="text-foreground">{tenant.name}</span>.
            </p>
          </div>
          {canManage && <InviteMemberButton tenantId={tenant.id} />}
        </header>

        <MembersList members={members ?? []} canManage={canManage} currentRole={role} />
      </section>

      {canManage && (
        <section className="flex flex-col gap-4">
          <header>
            <h2 className="font-display text-2xl font-extrabold tracking-tight text-foreground">
              Invitaciones pendientes
            </h2>
            <p className="text-sm text-muted-foreground">
              Links activos con acceso al espacio. Expiran automáticamente a los 14 días.
            </p>
          </header>
          <InvitationsList invitations={invitations ?? []} tenantSlug={tenant.slug} />
        </section>
      )}
    </div>
  )
}
