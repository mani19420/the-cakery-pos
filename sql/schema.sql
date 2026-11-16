-- =====================================================================
-- The Cakery POS - Supabase Database Schema
-- =====================================================================
-- Run this entire file in your Supabase SQL Editor:
--   Dashboard → SQL Editor → New Query → paste → Run
-- =====================================================================

-- 1. ORDERS TABLE -----------------------------------------------------
create table if not exists public.orders (
  id              bigserial primary key,
  order_number    text not null,
  table_number    integer not null,
  items           jsonb not null default '[]'::jsonb,
  subtotal        numeric not null default 0,
  tax             numeric not null default 0,
  total           numeric not null default 0,
  instructions    text default '',
  customer_note   text default '',
  status          text not null default 'received'
                  check (status in ('received','accepted','ready','served','rejected')),
  reject_reason   text default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Indexes for fast POS queries
create index if not exists idx_orders_status      on public.orders(status);
create index if not exists idx_orders_created_at   on public.orders(created_at desc);
create index if not exists idx_orders_table       on public.orders(table_number);
create index if not exists idx_orders_order_number on public.orders(order_number);

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

-- 2. RLS (Row Level Security) ----------------------------------------
-- The app uses the ANON key, so we need policies to allow public read/write.
-- For a small café this is fine. For production with auth, tighten these.

alter table public.orders enable row level security;

-- Anyone (anon + authenticated) can INSERT a new order (customer places order)
drop policy if exists "Anyone can insert orders" on public.orders;
create policy "Anyone can insert orders"
  on public.orders for insert
  to anon, authenticated
  with check (true);

-- Anyone can READ all orders (POS reads them; customer reads their own)
drop policy if exists "Anyone can read orders" on public.orders;
create policy "Anyone can read orders"
  on public.orders for select
  to anon, authenticated
  using (true);

-- Anyone can UPDATE order status (POS updates status; could be tightened)
drop policy if exists "POS can update orders" on public.orders;
create policy "POS can update orders"
  on public.orders for update
  to anon, authenticated
  using (true)
  with check (true);

-- Anyone can DELETE orders (optional — disable if you want full audit)
drop policy if exists "Anyone can delete orders" on public.orders;
create policy "Anyone can delete orders"
  on public.orders for delete
  to anon, authenticated
  using (true);

-- 3. REALTIME --------------------------------------------------------
-- Enable realtime on the orders table so the POS gets instant updates.
-- (Supabase now does this automatically when RLS is on, but let's be explicit.)
alter publication supabase_realtime add table public.orders;
-- Note: if the table was already in the publication, the above line will
-- raise a harmless error. Run the line below instead if that happens:
-- alter publication supabase_realtime set table public.orders;

-- =====================================================================
-- DONE. Your database is ready.
--
-- Next steps:
-- 1. Go to Project Settings → API
-- 2. Copy "Project URL" and "anon public" key
-- 3. Paste them into js/supabase-config.js
-- 4. Save and deploy to Vercel.
-- =====================================================================
