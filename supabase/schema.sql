-- Honeybun Kidswear — Supabase schema
-- Run this once in the Supabase SQL Editor (Project -> SQL Editor -> New query).

create extension if not exists "pgcrypto";

-- Who is an admin -------------------------------------------------------
-- Shoppers can now create accounts, and every account is a Supabase
-- "authenticated" user. So "authenticated" no longer means "admin": the
-- policies below check this list instead.
--
-- FIRST RUN ONLY: whoever already has an account when this runs (that is,
-- you, before any shopper has signed up) is made an admin. Before running,
-- open Authentication -> Users and make sure only your own admin account is
-- listed. To add another admin later:
--   insert into admins (user_id) select id from auth.users where email = 'her@email.com';

create table if not exists admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

insert into admins (user_id)
select id from auth.users
where not exists (select 1 from admins);

alter table admins enable row level security;

-- Security definer so the check works inside other tables' policies.
create or replace function is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from admins where user_id = auth.uid());
$$;

grant execute on function is_admin() to anon, authenticated;

drop policy if exists "Admins can see themselves" on admins;
create policy "Admins can see themselves" on admins
  for select to authenticated using (user_id = auth.uid());

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
  for select to anon, authenticated using (is_active = true);

drop policy if exists "Authenticated can read all products" on products;
create policy "Authenticated can read all products" on products
  for select to authenticated using (is_admin());

drop policy if exists "Authenticated can insert products" on products;
create policy "Authenticated can insert products" on products
  for insert to authenticated with check (is_admin());

drop policy if exists "Authenticated can update products" on products;
create policy "Authenticated can update products" on products
  for update to authenticated using (is_admin());

drop policy if exists "Authenticated can delete products" on products;
create policy "Authenticated can delete products" on products
  for delete to authenticated using (is_admin());

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

-- The shopper's account, when they were signed in at checkout (guests: null).
alter table orders add column if not exists user_id uuid references auth.users (id) on delete set null;
create index if not exists orders_user_id_idx on orders (user_id);

alter table orders enable row level security;

drop policy if exists "Anyone can place an order" on orders;
create policy "Anyone can place an order" on orders
  for insert to anon, authenticated
  with check (user_id is null or user_id = auth.uid());

drop policy if exists "Authenticated can read orders" on orders;
create policy "Authenticated can read orders" on orders
  for select to authenticated using (is_admin());

drop policy if exists "Shoppers can read their own orders" on orders;
create policy "Shoppers can read their own orders" on orders
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "Authenticated can update orders" on orders;
create policy "Authenticated can update orders" on orders
  for update to authenticated using (is_admin());

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
  for insert to authenticated with check (bucket_id = 'product-images' and is_admin());

drop policy if exists "Authenticated update product images" on storage.objects;
create policy "Authenticated update product images" on storage.objects
  for update to authenticated using (bucket_id = 'product-images' and is_admin());

drop policy if exists "Authenticated delete product images" on storage.objects;
create policy "Authenticated delete product images" on storage.objects
  for delete to authenticated using (bucket_id = 'product-images' and is_admin());

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
  for select to authenticated using (is_admin());

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

-- Lets the admin keep a collection in the shop but off the home screen.
alter table collections add column if not exists show_on_home boolean not null default true;

alter table collections enable row level security;

drop policy if exists "Public can read active collections" on collections;
create policy "Public can read active collections" on collections
  for select to anon, authenticated using (is_active = true);

drop policy if exists "Authenticated can read all collections" on collections;
create policy "Authenticated can read all collections" on collections
  for select to authenticated using (is_admin());

drop policy if exists "Authenticated can insert collections" on collections;
create policy "Authenticated can insert collections" on collections
  for insert to authenticated with check (is_admin());

drop policy if exists "Authenticated can update collections" on collections;
create policy "Authenticated can update collections" on collections
  for update to authenticated using (is_admin());

drop policy if exists "Authenticated can delete collections" on collections;
create policy "Authenticated can delete collections" on collections
  for delete to authenticated using (is_admin());

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
  for update to authenticated using (is_admin());

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
  for insert to authenticated with check (is_admin());

drop policy if exists "Authenticated can delete custom colors" on custom_colors;
create policy "Authenticated can delete custom colors" on custom_colors
  for delete to authenticated using (is_admin());

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
  for all to authenticated using (is_admin()) with check (is_admin());

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

-- Saved bags ---------------------------------------------------------------
-- A signed-in shopper's bag follows them from phone to laptop. One row per
-- shopper; they can only ever see and change their own.

create table if not exists carts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  items jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table carts enable row level security;

drop policy if exists "Shoppers manage their own bag" on carts;
create policy "Shoppers manage their own bag" on carts
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Visitor tracking -----------------------------------------------------------
-- One small row each time someone visits or opens/adds a product. No names,
-- emails or IP addresses: visitor_id is a random code the browser makes up,
-- only used to count unique visitors. Anyone can add a row (that is how the
-- website records it); only the admin can read them.

create table if not exists site_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  type text not null check (type in ('visit', 'page_view', 'product_view', 'add_to_cart')),
  visitor_id text not null check (char_length(visitor_id) between 8 and 64),
  path text check (char_length(path) <= 300),
  product_id uuid
);

create index if not exists site_events_created_idx on site_events (created_at desc);
create index if not exists site_events_product_idx on site_events (product_id) where product_id is not null;

alter table site_events enable row level security;

drop policy if exists "Anyone can record an event" on site_events;
create policy "Anyone can record an event" on site_events
  for insert to anon, authenticated with check (true);

drop policy if exists "Admins can read events" on site_events;
create policy "Admins can read events" on site_events
  for select to authenticated using (is_admin());

-- The numbers the admin Analytics page shows, worked out in the database so
-- they stay correct no matter how many events there are. Days are counted in
-- Beirut time.
create or replace function site_analytics(p_days int default 30)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  since timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365)));
  totals jsonb;
begin
  if not is_admin() then
    raise exception 'not allowed';
  end if;

  select jsonb_build_object(
    'visits', count(*) filter (where type = 'visit'),
    'visitors', count(distinct visitor_id),
    'page_views', count(*) filter (where type = 'page_view'),
    'product_views', count(*) filter (where type = 'product_view'),
    'add_to_cart', count(*) filter (where type = 'add_to_cart')
  ) into totals
  from site_events
  where created_at >= since;

  return totals || jsonb_build_object(
    'by_day', (
      select coalesce(jsonb_agg(d order by d.day), '[]'::jsonb)
      from (
        select (created_at at time zone 'Asia/Beirut')::date as day,
               count(*) filter (where type = 'visit') as visits,
               count(*) filter (where type = 'page_view') as views
        from site_events
        where created_at >= since
        group by 1
      ) d
    ),
    'top_products', (
      select coalesce(jsonb_agg(t order by t.views desc, t.adds desc), '[]'::jsonb)
      from (
        select e.product_id,
               coalesce(p.name, 'Deleted product') as name,
               p.images[1] as image,
               count(*) filter (where e.type = 'product_view') as views,
               count(*) filter (where e.type = 'add_to_cart') as adds
        from site_events e
        left join products p on p.id = e.product_id
        where e.created_at >= since and e.product_id is not null
        group by e.product_id, p.name, p.images[1]
        order by views desc, adds desc
        limit 10
      ) t
    )
  );
end;
$$;

grant execute on function site_analytics(int) to authenticated;
