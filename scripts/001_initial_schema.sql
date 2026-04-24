-- ============================================================================
-- Initial schema: multitenancy foundation
-- ============================================================================
-- This script creates:
--   * profiles        -> 1-1 with auth.users (display metadata)
--   * tenants         -> commerce accounts (one per business)
--   * tenant_members  -> join table (user <-> tenant with role)
--
-- The rest of the domain (products, variants, channels, sync jobs, storefront,
-- etc.) is added in later migrations.
-- ============================================================================

-- Required extensions
create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- ----------------------------------------------------------------------------
-- profiles: public mirror of auth.users with display info
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- tenants: top-level isolation unit
-- ----------------------------------------------------------------------------
create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  business_type text,         -- 'retail' | 'wholesale' | 'manufacturer' | 'other'
  currency char(3) not null default 'ARS',
  timezone text not null default 'America/Argentina/Buenos_Aires',
  plan text not null default 'starter',
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index if not exists tenants_slug_idx on public.tenants(slug);

-- ----------------------------------------------------------------------------
-- tenant_members: user <-> tenant with role
-- ----------------------------------------------------------------------------
-- Roles:
--   owner    -> can do everything including delete tenant
--   admin    -> can manage members and all data
--   operator -> can manage products / sync
--   viewer   -> read-only
create table if not exists public.tenant_members (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'viewer' check (role in ('owner', 'admin', 'operator', 'viewer')),
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create index if not exists tenant_members_user_idx on public.tenant_members(user_id);
create index if not exists tenant_members_tenant_idx on public.tenant_members(tenant_id);

-- ----------------------------------------------------------------------------
-- updated_at trigger helper
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists set_tenants_updated_at on public.tenants;
create trigger set_tenants_updated_at
  before update on public.tenants
  for each row execute function public.set_updated_at();
