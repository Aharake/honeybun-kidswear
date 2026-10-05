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
  images text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Per-size inventory: each product stores its sizes as
-- [{ "size": "0-3M", "stock": 5 }, { "size": "3-6M", "stock": 0 }, ...]
-- instead of one flat sizes[] + a single stock count, so each size can be
-- sold out independently and the storefront can show exactly that.
alter table products add column if not exists size_stock jsonb not null default '[]'::jsonb;

-- One-time migration from the old sizes[] + stock columns, if they still
-- exist from before this change (safe to re-run: only touches rows that
-- haven't been migrated yet).
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'products' and column_name = 'sizes')
     and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'products' and column_name = 'stock') then
    update products
    set size_stock = (
      select coalesce(jsonb_agg(jsonb_build_object('size', s, 'stock', coalesce(products.stock, 0))), '[]'::jsonb)
      from unnest(products.sizes) as s
    )
    where jsonb_array_length(size_stock) = 0 and sizes is not null and array_length(sizes, 1) > 0;

    alter table products drop column sizes;
    alter table products drop column stock;
  end if;
end $$;

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

-- Stock deduction on checkout ---------------------------------------------
-- Runs as the function owner (security definer) so a customer's anon key
-- can safely decrement stock for the exact sizes/quantities they bought,
-- without needing a general "update products" grant (which would let
-- anyone rewrite price, images, etc). Each product's size_stock row is
-- updated atomically, clamped at 0, so concurrent orders can't go negative.
create or replace function decrement_product_stock(items jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
begin
  for item in select * from jsonb_array_elements(items)
  loop
    update products
    set size_stock = (
      select coalesce(jsonb_agg(
        case
          when elem->>'size' = item->>'size'
          then jsonb_set(elem, '{stock}', to_jsonb(greatest(0, (elem->>'stock')::int - (item->>'qty')::int)))
          else elem
        end
      ), '[]'::jsonb)
      from jsonb_array_elements(size_stock) as elem
    )
    where id = (item->>'product_id')::uuid;
  end loop;
end;
$$;

grant execute on function decrement_product_stock(jsonb) to anon, authenticated;

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

-- Newsletter signups ------------------------------------------------------
-- No public select policy, same reasoning as orders: anyone can subscribe,
-- but the list of subscriber emails is only readable by the admin.

create table if not exists newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now()
);

alter table newsletter_subscribers enable row level security;

drop policy if exists "Anyone can subscribe" on newsletter_subscribers;
create policy "Anyone can subscribe" on newsletter_subscribers
  for insert to anon, authenticated with check (true);

drop policy if exists "Authenticated can read subscribers" on newsletter_subscribers;
create policy "Authenticated can read subscribers" on newsletter_subscribers
  for select to authenticated using (true);

-- Collections ---------------------------------------------------------------
-- Admin-managed product groupings (Girls, Boys, ...). products.category holds
-- the collection's name. Seeded once with Girls and Boys, only if the table is
-- empty, so re-running this file never brings back a collection you deleted
-- while others still exist.

create table if not exists collections (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  tagline text not null default '',
  image_url text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table collections enable row level security;

drop policy if exists "Public can read active collections" on collections;
create policy "Public can read active collections" on collections
  for select to anon using (is_active = true);

drop policy if exists "Authenticated can read all collections" on collections;
create policy "Authenticated can read all collections" on collections
  for select to authenticated using (true);

drop policy if exists "Authenticated can insert collections" on collections;
create policy "Authenticated can insert collections" on collections
  for insert to authenticated with check (true);

drop policy if exists "Authenticated can update collections" on collections;
create policy "Authenticated can update collections" on collections
  for update to authenticated using (true);

drop policy if exists "Authenticated can delete collections" on collections;
create policy "Authenticated can delete collections" on collections
  for delete to authenticated using (true);

insert into collections (name, slug, tagline, sort_order)
select * from (values
  ('Girls', 'girls', 'Dresses, bows & playful prints', 1),
  ('Boys', 'boys', 'Comfy everyday & weekend fits', 2)
) as v(name, slug, tagline, sort_order)
where not exists (select 1 from collections);

-- Sale ----------------------------------------------------------------------
-- One row of sale settings (the banner + on/off switch), plus per-product
-- flags: on_sale includes a product in the sale, sale_price optionally
-- overrides the percentage with an exact price.

create table if not exists sale_settings (
  id int primary key default 1 check (id = 1),
  is_active boolean not null default false,
  percent_off int not null default 20 check (percent_off between 1 and 90),
  banner_title text not null default 'The Honeybun Sale',
  banner_text text not null default 'Sweet savings on cozy favourites — for a limited time.',
  banner_cta text not null default 'Shop the sale',
  updated_at timestamptz not null default now()
);

insert into sale_settings (id) values (1) on conflict (id) do nothing;

alter table sale_settings enable row level security;

drop policy if exists "Anyone can read sale settings" on sale_settings;
create policy "Anyone can read sale settings" on sale_settings
  for select to anon, authenticated using (true);

drop policy if exists "Authenticated can update sale settings" on sale_settings;
create policy "Authenticated can update sale settings" on sale_settings
  for update to authenticated using (true);

alter table products add column if not exists on_sale boolean not null default false;
alter table products add column if not exists sale_price numeric(10,2);

-- An individual sale set from a single product's edit page. Works on its own,
-- whether or not the store-wide sale above is switched on.
alter table products add column if not exists product_sale_price numeric(10,2);

-- How each product photo is framed on the website (zoom + position), set by
-- the admin in the photo adjuster. Keyed by image URL:
-- { "https://…/photo.jpg": { "zoom": 1.4, "x": 0.5, "y": 0.3 } }
alter table products add column if not exists image_adjust jsonb not null default '{}'::jsonb;

-- Colours a product comes in (names from the admin's colour picker, e.g.
-- {'Pink','Cream'}). Powers the colour filter in the shop.
alter table products add column if not exists colors text[] not null default '{}'::text[];

-- Colours the admin adds on top of the built-in ones. Shoppers can read them
-- (so the swatch shows the right colour); only the admin can change them.
create table if not exists custom_colors (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  hex text not null check (hex ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz not null default now()
);

alter table custom_colors enable row level security;

drop policy if exists "Public can read custom colors" on custom_colors;
create policy "Public can read custom colors" on custom_colors
  for select to anon, authenticated using (true);

drop policy if exists "Authenticated can insert custom colors" on custom_colors;
create policy "Authenticated can insert custom colors" on custom_colors
  for insert to authenticated with check (true);

drop policy if exists "Authenticated can delete custom colors" on custom_colors;
create policy "Authenticated can delete custom colors" on custom_colors
  for delete to authenticated using (true);

-- Discount codes ------------------------------------------------------------
-- Not readable by shoppers at all (otherwise anyone could list every code).
-- Shoppers only ever go through the two functions below.

create table if not exists discount_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  type text not null check (type in ('percent', 'fixed')),
  value numeric(10,2) not null check (value > 0),
  min_subtotal numeric(10,2) not null default 0,
  max_uses int,
  uses int not null default 0,
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (type <> 'percent' or value <= 100)
);

alter table discount_codes enable row level security;

drop policy if exists "Authenticated manage discount codes" on discount_codes;
create policy "Authenticated manage discount codes" on discount_codes
  for all to authenticated using (true) with check (true);

create or replace function validate_discount_code(p_code text, p_subtotal numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c discount_codes%rowtype;
begin
  select * into c from discount_codes where code = upper(trim(p_code));

  if not found or not c.is_active then
    return jsonb_build_object('valid', false, 'message', 'That code isn''t valid.');
  end if;
  if c.expires_at is not null and c.expires_at < now() then
    return jsonb_build_object('valid', false, 'message', 'This code has expired.');
  end if;
  if c.max_uses is not null and c.uses >= c.max_uses then
    return jsonb_build_object('valid', false, 'message', 'This code has already been fully used.');
  end if;
  if p_subtotal < c.min_subtotal then
    return jsonb_build_object('valid', false, 'message',
      'Spend at least $' || trim(to_char(c.min_subtotal, 'FM999999990.00')) || ' to use this code.');
  end if;

  return jsonb_build_object(
    'valid', true, 'code', c.code, 'type', c.type,
    'value', c.value, 'min_subtotal', c.min_subtotal
  );
end;
$$;

create or replace function redeem_discount_code(p_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update discount_codes
  set uses = uses + 1
  where code = upper(trim(p_code)) and (max_uses is null or uses < max_uses);
end;
$$;

grant execute on function validate_discount_code(text, numeric) to anon, authenticated;
grant execute on function redeem_discount_code(text) to anon, authenticated;

alter table orders add column if not exists discount_code text;
alter table orders add column if not exists discount_amount numeric(10,2) not null default 0;
