-- Honeybun Kidswear — Supabase schema
-- Run this once in the Supabase SQL Editor (Project -> SQL Editor -> New query).

create extension if not exists "pgcrypto";

-- Products -------------------------------------------------------------

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text not null default '',
  price numeric(10,2) not null,
  compare_at_price numeric(10,2),
  category text not null default 'Uncategorized',
  sizes text[] not null default '{}',
  stock int not null default 0,
  images text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table products enable row level security;

drop policy if exists "Public can read active products" on products;
create policy "Public can read active products" on products
  for select to anon using (is_active = true);

drop policy if exists "Authenticated can read all products" on products;
create policy "Authenticated can read all products" on products
  for select to authenticated using (true);

drop policy if exists "Authenticated can insert products" on products;
create policy "Authenticated can insert products" on products
  for insert to authenticated with check (true);

drop policy if exists "Authenticated can update products" on products;
create policy "Authenticated can update products" on products
  for update to authenticated using (true);

drop policy if exists "Authenticated can delete products" on products;
create policy "Authenticated can delete products" on products
  for delete to authenticated using (true);

-- Orders -----------------------------------------------------------------
-- Note: there is intentionally NO public "select" policy on orders. Order
-- confirmation is shown right after checkout using the row returned by the
-- insert itself, so anonymous shoppers never need read access to the table
-- (which would otherwise let anyone list every customer's order).

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_name text not null,
  email text not null,
  phone text not null,
  address text not null,
  city text not null,
  notes text not null default '',
  items jsonb not null,
  subtotal numeric(10,2) not null,
  total numeric(10,2) not null,
  status text not null default 'pending',
  payment_method text not null default 'cod',
  created_at timestamptz not null default now()
);

alter table orders enable row level security;

drop policy if exists "Anyone can place an order" on orders;
create policy "Anyone can place an order" on orders
  for insert to anon, authenticated with check (true);

drop policy if exists "Authenticated can read orders" on orders;
create policy "Authenticated can read orders" on orders
  for select to authenticated using (true);

drop policy if exists "Authenticated can update orders" on orders;
create policy "Authenticated can update orders" on orders
  for update to authenticated using (true);

-- Storage: product images -------------------------------------------------

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "Public read product images" on storage.objects;
create policy "Public read product images" on storage.objects
  for select using (bucket_id = 'product-images');

drop policy if exists "Authenticated upload product images" on storage.objects;
create policy "Authenticated upload product images" on storage.objects
  for insert to authenticated with check (bucket_id = 'product-images');

drop policy if exists "Authenticated update product images" on storage.objects;
create policy "Authenticated update product images" on storage.objects
  for update to authenticated using (bucket_id = 'product-images');

drop policy if exists "Authenticated delete product images" on storage.objects;
create policy "Authenticated delete product images" on storage.objects
  for delete to authenticated using (bucket_id = 'product-images');
