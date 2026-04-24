-- ============================================================================
-- Sprint 2: tenant_invitations + accept_invitation RPC
-- ============================================================================
create table if not exists public.tenant_invitations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  email text not null,
  role text not null default 'viewer' check (role in ('admin', 'operator', 'viewer')),
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  invited_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (tenant_id, email)
);

create index if not exists tenant_invitations_email_idx on public.tenant_invitations(lower(email));
create index if not exists tenant_invitations_tenant_idx on public.tenant_invitations(tenant_id);

alter table public.tenant_invitations enable row level security;

drop policy if exists "invitations_select_admin_or_invitee" on public.tenant_invitations;
create policy "invitations_select_admin_or_invitee"
  on public.tenant_invitations for select
  using (
    public.tenant_role(tenant_id) in ('owner', 'admin')
    or lower(email) = lower((auth.jwt() ->> 'email'))
  );

drop policy if exists "invitations_insert_admin" on public.tenant_invitations;
create policy "invitations_insert_admin"
  on public.tenant_invitations for insert
  with check (
    public.tenant_role(tenant_id) in ('owner', 'admin')
    and invited_by = auth.uid()
  );

drop policy if exists "invitations_update_admin" on public.tenant_invitations;
create policy "invitations_update_admin"
  on public.tenant_invitations for update
  using (public.tenant_role(tenant_id) in ('owner', 'admin'));

drop policy if exists "invitations_delete_admin" on public.tenant_invitations;
create policy "invitations_delete_admin"
  on public.tenant_invitations for delete
  using (public.tenant_role(tenant_id) in ('owner', 'admin'));

create or replace function public.accept_invitation(_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _inv public.tenant_invitations;
  _user_email text;
  _user_id uuid := auth.uid();
begin
  if _user_id is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  select email into _user_email from auth.users where id = _user_id;

  select * into _inv
  from public.tenant_invitations
  where token = _token
  limit 1;

  if _inv.id is null then
    return jsonb_build_object('ok', false, 'error', 'invitation_not_found');
  end if;

  if _inv.accepted_at is not null then
    return jsonb_build_object('ok', false, 'error', 'already_accepted');
  end if;

  if _inv.expires_at < now() then
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;

  if lower(_inv.email) <> lower(_user_email) then
    return jsonb_build_object('ok', false, 'error', 'email_mismatch');
  end if;

  insert into public.tenant_members (tenant_id, user_id, role, invited_by)
  values (_inv.tenant_id, _user_id, _inv.role, _inv.invited_by)
  on conflict (tenant_id, user_id) do nothing;

  update public.tenant_invitations
     set accepted_at = now(), accepted_by = _user_id
   where id = _inv.id;

  return jsonb_build_object(
    'ok', true,
    'tenant_id', _inv.tenant_id,
    'slug', (select slug from public.tenants where id = _inv.tenant_id)
  );
end;
$$;

grant execute on function public.accept_invitation(text) to authenticated;
