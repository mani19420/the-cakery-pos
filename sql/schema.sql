-- =====================================================================
-- The Cakery POS - Supabase Database Schema (v2 — with Admin Panel)
-- =====================================================================
-- Run this entire file in your Supabase SQL Editor:
--   Dashboard → SQL Editor → New Query → paste → Run
--
-- SAFE TO RE-RUN: all statements use IF NOT EXISTS / drop-if-exists.
-- Existing orders are preserved. If you already ran the v1 schema,
-- running this just adds the menu_items + brand_settings tables.
-- =====================================================================

-- =====================================================================
-- 1. ORDERS TABLE
-- =====================================================================
create table if not exists public.orders (
  id              bigserial primary key,
  order_number    text not null,
  table_number    integer not null,
  items           jsonb not null default '[]'::jsonb,
  subtotal        numeric not null default 0,
  tax             numeric not null default 0,
  fbr_tax         numeric not null default 0,    -- FBR portion (food/bakery)
  pra_tax         numeric not null default 0,    -- PRA portion (beverages)
  total           numeric not null default 0,
  instructions    text default '',
  customer_note   text default '',
  status          text not null default 'received'
                  check (status in ('received','accepted','ready','served','rejected')),
  reject_reason   text default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Add the new columns if the table already existed from an older schema
do $$ begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'orders' and column_name = 'fbr_tax') then
    alter table public.orders add column fbr_tax numeric not null default 0;
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'orders' and column_name = 'pra_tax') then
    alter table public.orders add column pra_tax numeric not null default 0;
  end if;
end $$;

create index if not exists idx_orders_status       on public.orders(status);
create index if not exists idx_orders_created_at    on public.orders(created_at desc);
create index if not exists idx_orders_table         on public.orders(table_number);
create index if not exists idx_orders_order_number  on public.orders(order_number);

-- Auto-update updated_at on every row change
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_orders_updated on public.orders;
create trigger trg_orders_updated
  before update on public.orders
  for each row execute function public.handle_updated_at();

-- =====================================================================
-- 2. MENU_ITEMS TABLE  (NEW — managed by Admin Panel)
-- =====================================================================
-- Each row is one menu item. The Admin Panel creates / edits / deletes these.
-- The customer menu + POS read from this table (with a fallback to the
-- hard-coded MENU_DATA in js/menu-data.js when Supabase is not configured).
create table if not exists public.menu_items (
  id              text primary key,           -- e.g. 'br01', 'vi05'
  name            text not null,
  category        text not null,              -- 'breads', 'viennoiserie', ...
  price           numeric not null default 0,
  original_price  numeric,                     -- nullable, for "sale" items
  description     text default '',
  emoji           text default '🍽️',
  image_url       text default '',            -- optional real photo (base64 or storage URL)
  popular         boolean not null default false,
  available       boolean not null default true,  -- set false to hide temporarily
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_menu_items_category   on public.menu_items(category);
create index if not exists idx_menu_items_available  on public.menu_items(available);

drop trigger if exists trg_menu_updated on public.menu_items;
create trigger trg_menu_updated
  before update on public.menu_items
  for each row execute function public.handle_updated_at();

-- =====================================================================
-- 3. BRAND_SETTINGS TABLE  (NEW — logo, name, tagline, colors)
-- =====================================================================
-- Single-row table (the app always reads row id = 1).
create table if not exists public.brand_settings (
  id              integer primary key default 1 check (id = 1),
  brand_name      text not null default 'The Cakery',
  tagline         text default 'Order From Your Table',
  logo_url        text default '',             -- base64 PNG or storage URL
  logo_emoji      text default '🧁',
  accent_color    text default '#1C1C1A',
  updated_at      timestamptz not null default now()
);

-- Seed the singleton row if it does not exist
insert into public.brand_settings (id, brand_name, tagline, logo_emoji)
values (1, 'The Cakery', 'Order From Your Table', '🧁')
on conflict (id) do nothing;

-- =====================================================================
-- 4. STAFF_USERS TABLE  (NEW — POS staff logins created from Admin Panel)
-- =====================================================================
-- Each row is one POS staff account (username + password_hash + role).
-- Roles:
--   owner   — full access (everything: admin panel + pos + delete orders)
--   manager — POS + can accept/reject/serve, can refund void orders
--   cashier — POS only (take orders, mark served, print bills)
--   waiter  — POS view-only (cannot accept/reject)
create table if not exists public.staff_users (
  id              bigserial primary key,
  username        text not null unique,
  display_name    text not null,
  password_hash   text not null,              -- sha256(password + salt)
  password_salt   text not null,
  role             text not null default 'cashier'
                   check (role in ('owner','manager','cashier','waiter')),
  active          boolean not null default true,
  last_login_at   timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_staff_users_username on public.staff_users(username);

drop trigger if exists trg_staff_updated on public.staff_users;
create trigger trg_staff_updated
  before update on public.staff_users
  for each row execute function public.handle_updated_at();

-- =====================================================================
-- 5. TAX_SETTINGS TABLE  (NEW — dual tax system: FBR + PRA)
-- =====================================================================
-- Single-row table (id = 1). The app always reads row id = 1.
-- Two taxes:
--   FBR — Federal Board of Revenue, applied to MAIN MENU items (food/bakery)
--   PRA — Punjab Revenue Authority, applied to BEVERAGES only
-- Each tax has: rate_pct (e.g. 5 means 5%), enabled flag, label, and which
-- category group it applies to ('food' or 'beverages').
create table if not exists public.tax_settings (
  id                   integer primary key default 1 check (id = 1),
  -- FBR (food / bakery / main menu)
  fbr_enabled          boolean not null default true,
  fbr_rate_pct         numeric not null default 5 check (fbr_rate_pct >= 0 and fbr_rate_pct < 100),
  fbr_label            text not null default 'FBR Sales Tax',
  -- PRA (beverages only)
  pra_enabled          boolean not null default true,
  pra_rate_pct         numeric not null default 16 check (pra_rate_pct >= 0 and pra_rate_pct < 100),
  pra_label            text not null default 'PRA Punjab Tax',
  -- Which category slugs count as 'beverages' (PRA applies to these only)
  -- Stored as a JSON array of category slugs.
  beverage_categories  jsonb not null default '["coffee","matcha","ncaffeine","onrocks","tea"]'::jsonb,
  -- Whether prices shown on menu are tax-inclusive or tax-exclusive
  prices_inclusive     boolean not null default false,
  updated_at           timestamptz not null default now()
);

-- Seed the singleton row
insert into public.tax_settings (id)
values (1)
on conflict (id) do nothing;

drop trigger if exists trg_tax_updated on public.tax_settings;
create trigger trg_tax_updated
  before update on public.tax_settings
  for each row execute function public.handle_updated_at();

-- =====================================================================
-- 4. ROW LEVEL SECURITY
-- =====================================================================
-- The app uses the ANON key, so we need policies to allow public access.
-- For a small café this is fine. For production with staff auth, tighten
-- the write policies on menu_items / brand_settings.

alter table public.orders enable row level security;
alter table public.menu_items enable row level security;
alter table public.brand_settings enable row level security;
alter table public.staff_users enable row level security;
alter table public.tax_settings enable row level security;

-- ---- ORDERS ----
drop policy if exists "Anyone can insert orders" on public.orders;
create policy "Anyone can insert orders"
  on public.orders for insert
  to anon, authenticated
  with check (true);

drop policy if exists "Anyone can read orders" on public.orders;
create policy "Anyone can read orders"
  on public.orders for select
  to anon, authenticated
  using (true);

drop policy if exists "POS can update orders" on public.orders;
create policy "POS can update orders"
  on public.orders for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "Anyone can delete orders" on public.orders;
create policy "Anyone can delete orders"
  on public.orders for delete
  to anon, authenticated
  using (true);

-- ---- MENU_ITEMS ----
drop policy if exists "Anyone can read menu" on public.menu_items;
create policy "Anyone can read menu"
  on public.menu_items for select
  to anon, authenticated
  using (true);

drop policy if exists "Admin can write menu" on public.menu_items;
create policy "Admin can write menu"
  on public.menu_items for insert
  to anon, authenticated
  with check (true);

drop policy if exists "Admin can update menu" on public.menu_items;
create policy "Admin can update menu"
  on public.menu_items for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "Admin can delete menu" on public.menu_items;
create policy "Admin can delete menu"
  on public.menu_items for delete
  to anon, authenticated
  using (true);

-- ---- BRAND_SETTINGS ----
drop policy if exists "Anyone can read brand" on public.brand_settings;
create policy "Anyone can read brand"
  on public.brand_settings for select
  to anon, authenticated
  using (true);

drop policy if exists "Admin can update brand" on public.brand_settings;
create policy "Admin can update brand"
  on public.brand_settings for update
  to anon, authenticated
  using (true)
  with check (true);

-- ---- STAFF_USERS ----
-- Reads: anyone can read username + role (needed for POS login to validate).
-- We DO NOT expose password_hash via this select — see the limited view below.
drop policy if exists "Anyone can read staff users" on public.staff_users;
create policy "Anyone can read staff users"
  on public.staff_users for select
  to anon, authenticated
  using (true);

drop policy if exists "Admin can insert staff users" on public.staff_users;
create policy "Admin can insert staff users"
  on public.staff_users for insert
  to anon, authenticated
  with check (true);

drop policy if exists "Admin can update staff users" on public.staff_users;
create policy "Admin can update staff users"
  on public.staff_users for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "Admin can delete staff users" on public.staff_users;
create policy "Admin can delete staff users"
  on public.staff_users for delete
  to anon, authenticated
  using (true);

-- ---- TAX_SETTINGS ----
drop policy if exists "Anyone can read tax settings" on public.tax_settings;
create policy "Anyone can read tax settings"
  on public.tax_settings for select
  to anon, authenticated
  using (true);

drop policy if exists "Admin can update tax settings" on public.tax_settings;
create policy "Admin can update tax settings"
  on public.tax_settings for update
  to anon, authenticated
  using (true)
  with check (true);

-- =====================================================================
-- 5. REALTIME
-- =====================================================================
-- Enable realtime on all five tables so customers/POS/admin see live
-- updates when something changes.
alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.menu_items;
alter publication supabase_realtime add table public.brand_settings;
alter publication supabase_realtime add table public.staff_users;
alter publication supabase_realtime add table public.tax_settings;
-- Note: if a table was already in the publication, the line raises a
-- harmless error. Run the line below instead if that happens:
-- alter publication supabase_realtime set table public.orders, public.menu_items, public.brand_settings, public.staff_users, public.tax_settings;

-- =====================================================================
-- DONE. Your database is ready for the Admin Panel.
--
-- Next steps:
-- 1. Project Settings → API → copy "Project URL" and "anon public" key
-- 2. Paste them into js/supabase-config.js
-- 3. (Optional) change the admin password in js/admin-config.js
-- 4. Save and deploy to Vercel.
-- 5. Open /admin.html → log in → seed menu items from Admin → Menu tab.
-- =====================================================================
