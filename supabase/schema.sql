-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Auth: uses built-in Supabase auth schema (no changes needed here)

-- Public tables
create table if not exists public.products (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  price numeric(12,2) not null check (price >= 0),
  image_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.carts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'open', -- open | ordered
  created_at timestamptz not null default now()
);

create table if not exists public.cart_items (
  id uuid primary key default uuid_generate_v4(),
  cart_id uuid not null references public.carts(id) on delete cascade,
  product_id uuid not null references public.products(id),
  qty integer not null check (qty > 0),
  created_at timestamptz not null default now()
);

-- RLS
alter table public.products enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;

-- Products: allow anyone to read, only authenticated users to write
create policy "Public read products" on public.products
  for select using (true);
create policy "Auth write products" on public.products
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Carts: only the owner may access
create policy "Owner rw carts" on public.carts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Cart items: only through carts owned by user
create policy "Owner rw cart_items" on public.cart_items
  for all using (
    exists (select 1 from public.carts c where c.id = cart_id and c.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.carts c where c.id = cart_id and c.user_id = auth.uid())
  );

-- ============================================
-- Suppliers and Purchase Orders (RF008 / RF009)
-- ============================================

-- Suppliers
create table if not exists public.suppliers (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  email text,
  created_at timestamptz not null default now()
);

alter table public.suppliers enable row level security;

create policy "Public read suppliers" on public.suppliers
  for select using (true);
create policy "Auth write suppliers" on public.suppliers
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Purchase Orders
create table if not exists public.purchase_orders (
  id uuid primary key default uuid_generate_v4(),
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  expected_date date not null,
  status text not null default 'DRAFT', -- DRAFT | SENT | RECEIVED | CANCELLED
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.purchase_orders enable row level security;

create policy "Public read purchase_orders" on public.purchase_orders
  for select using (true);
create policy "Auth write purchase_orders" on public.purchase_orders
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Purchase Order Items
create table if not exists public.purchase_order_items (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references public.purchase_orders(id) on delete cascade,
  product_id uuid not null references public.inventory_products(id) on delete restrict,
  quantity_ordered integer not null check (quantity_ordered > 0),
  quantity_received integer not null default 0 check (quantity_received >= 0),
  unit_cost numeric(12,2),
  created_at timestamptz not null default now()
);

alter table public.purchase_order_items enable row level security;

create policy "Public read purchase_order_items" on public.purchase_order_items
  for select using (true);
create policy "Auth write purchase_order_items" on public.purchase_order_items
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

