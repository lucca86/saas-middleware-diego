"use client"

import { useTransition } from "react"
import { useParams } from "next/navigation"
import { MoreVertical, Shield, UserMinus } from "lucide-react"
import { toast } from "sonner"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  removeMemberAction,
  updateMemberRoleAction,
} from "@/app/app/[tenant]/settings/members/actions"

type Profile = {
  id: string
  email: string | null
  full_name: string | null
  avatar_url: string | null
}

type Member = {
  id: string
  role: string
  created_at: string
  user_id: string
  profiles: Profile | Profile[]
}

function pickProfile(p: Profile | Profile[]): Profile | null {
  if (Array.isArray(p)) return p[0] ?? null
  return p ?? null
}

function getInitials(profile: Profile | null) {
  if (!profile) return "?"
  const source = profile.full_name || profile.email || "?"
  return source
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

function roleBadgeClass(role: string) {
  switch (role) {
    case "owner":
      return "bg-primary/10 text-primary border-primary/20"
    case "admin":
      return "bg-tertiary/10 text-tertiary border-tertiary/20"
    case "operator":
      return "bg-secondary/10 text-secondary-foreground border-secondary/20"
    default:
      return "bg-surface-container-high text-on-surface-variant border-outline-variant"
  }
}

function roleLabel(role: string) {
  return { owner: "Propietario", admin: "Admin", operator: "Operador", viewer: "Viewer" }[role] ?? role
}

export function MembersList({
  members,
  canManage,
  currentRole,
}: {
  members: Member[]
  canManage: boolean
  currentRole: string
}) {
  const params = useParams<{ tenant: string }>()
  const [isPending, startTransition] = useTransition()

  function handleUpdateRole(memberId: string, role: "admin" | "operator" | "viewer") {
    startTransition(async () => {
      const result = await updateMemberRoleAction({
        memberId,
        tenantSlug: params.tenant,
        role,
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success("Rol actualizado")
    })
  }

  function handleRemove(memberId: string) {
    startTransition(async () => {
      const result = await removeMemberAction({
        memberId,
        tenantSlug: params.tenant,
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success("Miembro quitado")
    })
  }

  if (members.length === 0) {
    return (
      <div className="rounded border border-dashed border-outline-variant p-8 text-center text-sm text-on-surface-variant">
        Sin miembros todavía.
      </div>
    )
  }

  return (
    <ul className="overflow-hidden rounded border border-outline divide-y divide-outline-variant">
      {members.map((member) => {
        const profile = pickProfile(member.profiles)
        const isOwner = member.role === "owner"
        return (
          <li
            key={member.id}
            className="flex items-center justify-between gap-4 bg-surface-container-low px-4 py-3"
          >
            <div className="flex items-center gap-3 min-w-0">
              <Avatar className="h-10 w-10 border border-outline-variant">
                {profile?.avatar_url && (
                  <AvatarImage src={profile.avatar_url} alt="" />
                )}
                <AvatarFallback className="bg-surface-container text-xs font-semibold text-on-surface">
                  {getInitials(profile)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-on-surface">
                  {profile?.full_name || profile?.email || "Sin nombre"}
                </p>
                <p className="truncate font-mono text-xs text-on-surface-variant">
                  {profile?.email ?? "—"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className={roleBadgeClass(member.role)}>
                {roleLabel(member.role)}
              </Badge>
              {canManage && !isOwner && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={isPending}
                      aria-label="Acciones del miembro"
                      className="h-8 w-8"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel className="flex items-center gap-2 text-xs uppercase tracking-wider text-on-surface-variant">
                      <Shield className="h-3 w-3" />
                      Cambiar rol
                    </DropdownMenuLabel>
                    {currentRole === "owner" && (
                      <DropdownMenuItem onClick={() => handleUpdateRole(member.id, "admin")}>
                        Admin
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => handleUpdateRole(member.id, "operator")}>
                      Operador
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleUpdateRole(member.id, "viewer")}>
                      Viewer
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => handleRemove(member.id)}
                      className="text-destructive focus:text-destructive"
                    >
                      <UserMinus className="mr-2 h-4 w-4" />
                      Quitar del espacio
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
