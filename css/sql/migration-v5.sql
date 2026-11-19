-- =====================================================================
-- The Cakery POS — Migration to v5 (Payment Method + Order Edit)
-- =====================================================================
-- Run ONLY this file in your Supabase SQL Editor if you already ran the
-- v4 schema (or v1/v2/v3). It adds:
--   - order_type      column on orders ('dine_in' / 'takeaway')
--   - payment_method  column on orders ('cash' / 'card')
-- Without touching your existing orders, menu_items, brand_settings,
-- staff_users, or tax_settings.
--
-- SAFE TO RE-RUN: every statement uses IF NOT EXISTS guards.
-- =====================================================================

-- 1. Add order_type column (default 'dine_in' for backward compatibility)
do $$ begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'orders' and column_name = 'order_type') then
    alter table public.orders add column order_type text not null default 'dine_in';
  end if;
end $$;

-- Add the CHECK constraint if missing (ignore error if it already exists)
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'orders_order_type_chk' and conrelid = 'public.orders'::regclass) then
    alter table public.orders add constraint orders_order_type_chk check (order_type in ('dine_in','takeaway'));
  end if;
exception when duplicate_object then null;
end $$;

-- 2. Add payment_method column (default 'cash')
do $$ begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'orders' and column_name = 'payment_method') then
    alter table public.orders add column payment_method text not null default 'cash';
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'orders_payment_method_chk' and conrelid = 'public.orders'::regclass) then
    alter table public.orders add constraint orders_payment_method_chk check (payment_method in ('cash','card'));
  end if;
exception when duplicate_object then null;
end $$;

-- 3. Backfill defaults for any existing rows (defensive — should be a no-op)
update public.orders set order_type = 'dine_in' where order_type is null;
update public.orders set payment_method = 'cash' where payment_method is null;

-- =====================================================================
-- DONE. After this runs:
--   - Customers can choose Take Away / Dine In + Cash / Card at checkout
--   - POS staff can edit any active order (qty, remove item, add item)
--   - Bills show the order type and payment method
-- =====================================================================
