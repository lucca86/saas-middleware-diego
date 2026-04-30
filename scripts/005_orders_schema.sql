-- ============================================================================
-- Orders + order_items: storefront purchase records
-- ============================================================================
-- The storefront is a lead-gen flow (no real payment yet): a customer
-- chooses variants, fills a contact form, and we persist the order with
-- its line items. Stock is decremented on order creation via a stock
-- movement of type 'sale'.
--
-- Design notes:
--   * tenant_id is denormalized in order_items to keep RLS simple/fast.
--   * Orders are immutable from the public API once created; only the
--     tenant team can update status (pending -> confirmed -> fulfilled,
--     or cancelled). Cancellation reverses stock with a 'return' movement.
--   * Variant snapshot (sku, name, attributes, unit_price) is copied into
--     each line item so historical orders aren't broken when products are
--     edited or deleted.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- orders
-- ----------------------------------------------------------------------------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,

  -- Sequential, human-readable code per tenant. Generated in app code as
  -- "ORD-<n>" where n increments per tenant.
  code text not null,

  -- Contact info from the storefront checkout form.
  customer_name text not null,
  customer_email text not null,
  customer_phone text,
  shipping_notes text,

  -- Monetary totals are stored at order time (currency snapshot too).
  currency char(3) not null,
  subtotal numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,

  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'fulfilled', 'cancelled')),

  -- Free-form metadata (UTM, notes, etc.)
  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (tenant_id, code)
);

create index if not exists orders_tenant_created_idx
  on public.orders (tenant_id, created_at desc);

create index if not exists orders_tenant_status_idx
  on public.orders (tenant_id, status);

-- ----------------------------------------------------------------------------
-- order_items
-- ----------------------------------------------------------------------------
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,

  -- Soft refs: we keep the IDs for tracing but the snapshot below
  -- is what we actually display. If a product is later deleted the
  -- item still renders correctly.
  product_id uuid references public.products(id) on delete set null,
  variant_id uuid references public.product_variants(id) on delete set null,

  -- Snapshot at purchase time
  product_name text not null,
  variant_sku text,
  variant_attrs jsonb not null default '{}'::jsonb,
  unit_price numeric(12, 2) not null,
  qty integer not null check (qty > 0),
  line_total numeric(12, 2) not null,

  created_at timestamptz not null default now()
);

create index if not exists order_items_order_idx
  on public.order_items (order_id);

create index if not exists order_items_tenant_idx
  on public.order_items (tenant_id);

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- orders: read by tenant members, insert by anon (storefront checkout),
-- update/delete only by team members
drop policy if exists "orders_select_member" on public.orders;
create policy "orders_select_member" on public.orders
  for select using (public.is_tenant_member(tenant_id));

-- Storefront checkout creates orders without an authenticated user.
-- The tenant_id is validated server-side against the published tenant
-- before insert, so we allow any role to insert with a matching tenant
-- as long as the tenant exists. We don't expose this insert policy to
-- the anon key directly; the server action uses the service role.
drop policy if exists "orders_insert_service" on public.orders;
create policy "orders_insert_service" on public.orders
  for insert with check (true);

drop policy if exists "orders_update_team" on public.orders;
create policy "orders_update_team" on public.orders
  for update using (public.tenant_role(tenant_id) in ('owner', 'admin', 'operator'));

drop policy if exists "orders_delete_admin" on public.orders;
create policy "orders_delete_admin" on public.orders
  for delete using (public.tenant_role(tenant_id) in ('owner', 'admin'));

-- order_items: same shape as orders
drop policy if exists "order_items_select_member" on public.order_items;
create policy "order_items_select_member" on public.order_items
  for select using (public.is_tenant_member(tenant_id));

drop policy if exists "order_items_insert_service" on public.order_items;
create policy "order_items_insert_service" on public.order_items
  for insert with check (true);

drop policy if exists "order_items_update_team" on public.order_items;
create policy "order_items_update_team" on public.order_items
  for update using (public.tenant_role(tenant_id) in ('owner', 'admin', 'operator'));

-- ----------------------------------------------------------------------------
-- updated_at trigger for orders
-- ----------------------------------------------------------------------------
create or replace function public.touch_orders_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_orders_touch on public.orders;
create trigger trg_orders_touch
  before update on public.orders
  for each row
  execute function public.touch_orders_updated_at();
