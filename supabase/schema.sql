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

-- ============================================
-- Sales Table for Import Feature
-- ============================================

-- Sales table to store sales records imported from external systems
create table if not exists public.sales (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid references public.products(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  total_price numeric(12,2) not null check (total_price >= 0),
  sale_date date not null,
  customer_name text,
  invoice_number text,
  import_source text default 'manual', -- manual | csv_excel_import | pos_system
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sales enable row level security;

create policy "Public read sales" on public.sales
  for select using (true);
create policy "Auth write sales" on public.sales
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Create indexes for better performance
create index if not exists idx_sales_product_id on public.sales(product_id);
create index if not exists idx_sales_sale_date on public.sales(sale_date);
create index if not exists idx_sales_import_source on public.sales(import_source);
create index if not exists idx_sales_created_at on public.sales(created_at);

-- ============================================
-- Export History Table for Audit Trail
-- ============================================

-- Export history table to track all data exports for audit purposes
create table if not exists public.export_history (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  user_name text not null,
  report_type text not null check (report_type in ('inventory', 'sales', 'orders')),
  format text not null check (format in ('csv', 'pdf')),
  date_from date,
  date_to date,
  total_records integer not null check (total_records >= 0),
  file_name text not null,
  created_at timestamptz not null default now()
);

alter table public.export_history enable row level security;

create policy "Public read export_history" on public.export_history
  for select using (true);
create policy "Auth write export_history" on public.export_history
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Create indexes for export history
create index if not exists idx_export_history_user_id on public.export_history(user_id);
create index if not exists idx_export_history_report_type on public.export_history(report_type);
create index if not exists idx_export_history_created_at on public.export_history(created_at);


-- ============================================
-- Roles & Users Management
-- ============================================

create table if not exists public.roles (
  id uuid primary key default uuid_generate_v4(),
  code text not null unique check (code in ('ADMIN', 'MANAGER', 'WAREHOUSE', 'CASHIER')),
  name text not null unique,
  description text not null,
  permissions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.roles enable row level security;

create policy "Authenticated manage roles" on public.roles
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create table if not exists public.app_users (
  id uuid primary key default uuid_generate_v4(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  full_name text not null,
  email text not null unique,
  role_id uuid not null references public.roles(id) on delete restrict,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_users_email_format check (
    email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}$'
  )
);

alter table public.app_users enable row level security;

create policy "Authenticated manage app_users" on public.app_users
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create index if not exists idx_app_users_email on public.app_users(email);
create index if not exists idx_app_users_role_id on public.app_users(role_id);

create or replace function public.set_app_users_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_app_users_updated_at
before update on public.app_users
for each row execute function public.set_app_users_updated_at();

insert into public.roles (code, name, description, permissions)
values
  (
    'ADMIN',
    'Administrador',
    'Acceso total a todos los modulos y configuraciones.',
    '[
      "inventory:read",
      "inventory:write",
      "orders:read",
      "orders:write",
      "alerts:read",
      "alerts:write",
      "reports:read",
      "reports:write",
      "sales:import",
      "roles:read",
      "roles:write",
      "users:read",
      "users:write"
    ]'
  ),
  (
    'MANAGER',
    'Gerente',
    'Consulta indicadores, reportes y autoriza pedidos.',
    '[
      "inventory:read",
      "orders:read",
      "orders:authorize",
      "reports:read",
      "kpis:view"
    ]'
  ),
  (
    'WAREHOUSE',
    'Almacenista',
    'Gestiona inventario y flujo de pedidos.',
    '[
      "inventory:read",
      "inventory:write",
      "orders:read",
      "orders:write"
    ]'
  ),
  (
    'CASHIER',
    'Cajero',
    'Consulta inventario y reporta ventas manualmente.',
    '[
      "inventory:read",
      "sales:import"
    ]'
  )
on conflict (code)
do update
set name = excluded.name,
    description = excluded.description,
    permissions = excluded.permissions;

-- ============================================
-- Habilitar Realtime para actualizaciones en tiempo real
-- ============================================

-- Habilitar Realtime en las tablas principales para el dashboard
alter publication supabase_realtime add table public.products;
alter publication supabase_realtime add table public.carts;
alter publication supabase_realtime add table public.cart_items;
alter publication supabase_realtime add table public.inventory_products;
alter publication supabase_realtime add table public.purchase_orders;
alter publication supabase_realtime add table public.purchase_order_items;
alter publication supabase_realtime add table public.sales;