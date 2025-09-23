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
