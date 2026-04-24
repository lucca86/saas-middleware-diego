-- ============================================================================
-- Row Level Security policies for the foundation tables
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Helper: security-definer function to check membership without recursing
-- ----------------------------------------------------------------------------
create or replace function public.is_tenant_member(p_tenant_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.tenant_members
    where tenant_id = p_tenant_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.tenant_role(p_tenant_id uuid)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from public.tenant_members
  where tenant_id = p_tenant_id
    and user_id = auth.uid()
  limit 1;
$$;

-- ----------------------------------------------------------------------------
-- profiles: each user manages their own profile row
-- ----------------------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- ----------------------------------------------------------------------------
-- tenants: readable by members, creatable by any authenticated user,
-- updatable/deletable by owners/admins
-- ----------------------------------------------------------------------------
alter table public.tenants enable row level security;

drop policy if exists "tenants_select_member" on public.tenants;
create policy "tenants_select_member" on public.tenants
  for select using (public.is_tenant_member(id));

drop policy if exists "tenants_insert_authenticated" on public.tenants;
create policy "tenants_insert_authenticated" on public.tenants
  for insert with check (auth.uid() is not null);

drop policy if exists "tenants_update_admin" on public.tenants;
create policy "tenants_update_admin" on public.tenants
  for update using (public.tenant_role(id) in ('owner', 'admin'));

drop policy if exists "tenants_delete_owner" on public.tenants;
create policy "tenants_delete_owner" on public.tenants
  for delete using (public.tenant_role(id) = 'owner');

-- ----------------------------------------------------------------------------
-- tenant_members: users see their own memberships plus others in their tenants
-- Only owners/admins can add or modify memberships
-- ----------------------------------------------------------------------------
alter table public.tenant_members enable row level security;

drop policy if exists "tenant_members_select_self_or_admin" on public.tenant_members;
create policy "tenant_members_select_self_or_admin" on public.tenant_members
  for select using (
    user_id = auth.uid()
    or public.tenant_role(tenant_id) in ('owner', 'admin')
  );

-- Allow the first membership insert (owner on their own new tenant) AND admins inviting others
drop policy if exists "tenant_members_insert_owner_or_admin" on public.tenant_members;
create policy "tenant_members_insert_owner_or_admin" on public.tenant_members
  for insert with check (
    -- Self-insert allowed when creating your own tenant (no existing members yet)
    (user_id = auth.uid() and role = 'owner' and not exists (
      select 1 from public.tenant_members tm where tm.tenant_id = tenant_members.tenant_id
    ))
    or public.tenant_role(tenant_id) in ('owner', 'admin')
  );

drop policy if exists "tenant_members_update_admin" on public.tenant_members;
create policy "tenant_members_update_admin" on public.tenant_members
  for update using (public.tenant_role(tenant_id) in ('owner', 'admin'));

drop policy if exists "tenant_members_delete_admin_or_self" on public.tenant_members;
create policy "tenant_members_delete_admin_or_self" on public.tenant_members
  for delete using (
    user_id = auth.uid()
    or public.tenant_role(tenant_id) in ('owner', 'admin')
  );
