-- =====================================================================
-- The Cakery POS — Migration to v6 (Payment-method-aware PRA tax)
-- =====================================================================
-- Run ONLY this file in your Supabase SQL Editor if you already ran the
-- v5 schema (or v4). It:
--   1. Adds pra_rate_cash_pct (default 16%) and pra_rate_card_pct (default 8%)
--      to the tax_settings table — PRA rate now depends on payment method.
--   2. Bumps the FBR rate to 18% (same for cash and card).
--   3. Keeps the old pra_rate_pct column for backward compatibility.
--
-- After this runs:
--   - Cash payment  → PRA applies at pra_rate_cash_pct (16%)
--   - Card payment  → PRA applies at pra_rate_card_pct (8%)
--   - FBR applies at fbr_rate_pct (18%) regardless of payment method
--
-- SAFE TO RE-RUN: every statement uses IF NOT EXISTS guards.
-- =====================================================================

-- 1. Add pra_rate_cash_pct (default 16%) if missing
do $$ begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'tax_settings' and column_name = 'pra_rate_cash_pct') then
    alter table public.tax_settings add column pra_rate_cash_pct numeric not null default 16
      check (pra_rate_cash_pct >= 0 and pra_rate_cash_pct < 100);
  end if;
end $$;

-- 2. Add pra_rate_card_pct (default 8%) if missing
do $$ begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'tax_settings' and column_name = 'pra_rate_card_pct') then
    alter table public.tax_settings add column pra_rate_card_pct numeric not null default 8
      check (pra_rate_card_pct >= 0 and pra_rate_card_pct < 100);
  end if;
end $$;

-- 3. Drop and recreate the CHECK constraints so they don't clash with
--    any future ALTER (idempotent).
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'tax_settings_pra_rate_cash_pct_check' and conrelid = 'public.tax_settings'::regclass) then
    alter table public.tax_settings add constraint tax_settings_pra_rate_cash_pct_check
      check (pra_rate_cash_pct >= 0 and pra_rate_cash_pct < 100);
  end if;
exception when duplicate_object then null;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'tax_settings_pra_rate_card_pct_check' and conrelid = 'public.tax_settings'::regclass) then
    alter table public.tax_settings add constraint tax_settings_pra_rate_card_pct_check
      check (pra_rate_card_pct >= 0 and pra_rate_card_pct < 100);
  end if;
exception when duplicate_object then null;
end $$;

-- 4. Backfill the new cash column from the legacy pra_rate_pct if a custom
--    rate was set (so a previous PRA config isn't silently reset to 16).
update public.tax_settings
   set pra_rate_cash_pct = pra_rate_pct
 where pra_rate_pct is not null
   and pra_rate_pct <> 16
   and pra_rate_cash_pct = 16;

-- 5. Set the FBR rate to 18% and PRA defaults to the new Pakistan rates
--    (FBR 18% on food, PRA 16% on beverages paid by cash, 8% by card).
update public.tax_settings
   set fbr_rate_pct      = 18,
       pra_rate_cash_pct = 16,
       pra_rate_card_pct = 8,
       updated_at        = now()
 where id = 1;

-- =====================================================================
-- DONE. The customer cart will now show:
--   - FBR Sales Tax (18%) on food items (cash or card)
--   - PRA Punjab Tax (16% on cash / 8% on card) on beverages
-- The cart total recomputes automatically when the customer switches
-- between Cash and Card at checkout.
-- =====================================================================
