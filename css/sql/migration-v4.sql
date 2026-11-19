-- =====================================================================
-- The Cakery POS — Migration to v4 (Users + Dual Tax System)
-- =====================================================================
-- Run ONLY this file in your Supabase SQL Editor if you already ran the
-- v1/v2/v3 schema before. It adds the new staff_users + tax_settings
-- tables and the fbr_tax/pra_tax columns on the orders table — without
-- touching your existing orders, menu_items, or brand_settings.
--
-- SAFE TO RE-RUN: every statement uses IF NOT EXISTS / DO-block guards.
-- =====================================================================

-- 1. Add fbr_tax + pra_tax columns to orders (if missing)
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

-- 2. Create staff_users table
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

-- 3. Create tax_settings table (single row, id = 1)
create table if not exists public.tax_settings (
  id                   integer primary key default 1 check (id = 1),
  fbr_enabled          boolean not null default true,
  fbr_rate_pct         numeric not null default 5 check (fbr_rate_pct >= 0 and fbr_rate_pct < 100),
  fbr_label            text not null default 'FBR Sales Tax',
  pra_enabled          boolean not null default true,
  pra_rate_pct         numeric not null default 16 check (pra_rate_pct >= 0 and pra_rate_pct < 100),
  pra_label            text not null default 'PRA Punjab Tax',
  beverage_categories  jsonb not null default '["coffee","matcha","ncaffeine","onrocks","tea"]'::jsonb,
  prices_inclusive     boolean not null default false,
  updated_at           timestamptz not null default now()
);

insert into public.tax_settings (id)
values (1)
on conflict (id) do nothing;

drop trigger if exists trg_tax_updated on public.tax_settings;
create trigger trg_tax_updated
  before update on public.tax_settings
  for each row execute function public.handle_updated_at();

-- 4. Enable RLS on the new tables
alter table public.staff_users enable row level security;
alter table public.tax_settings enable row level security;

-- 5. Policies for staff_users (anyone can read, admin can write)
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

-- 6. Policies for tax_settings
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

-- 7. Add the new tables to the realtime publication
alter publication supabase_realtime add table public.staff_users;
alter publication supabase_realtime add table public.tax_settings;

-- =====================================================================
-- DONE.
-- After this runs, open /admin.html → Users tab to create your first
-- POS staff account, and the Tax tab to confirm the rates.
-- Then open /pos.html — it will ask for username + password.
-- =====================================================================
