-- =====================================================================
-- The Cakery POS — migration v9
--
-- Fixes the Tax Settings save bug: the tax_settings table had an
-- UPDATE-only RLS policy, so saving from the Admin → Tax tab failed
-- with "new row violates row-level security policy" whenever the
-- single row (id = 1) was missing or the upsert tried to INSERT.
--
-- WHAT THIS DOES
--   1. Allows INSERT on tax_settings (needed for the upsert save).
--   2. Re-inserts the default row if it is missing.
--   3. (Optional cleanup) Kept idempotent — safe to run twice.
--
-- RUN IN: Supabase Dashboard → SQL Editor → paste → Run
-- =====================================================================

-- 1. INSERT policy for tax_settings (upsert = INSERT .. ON CONFLICT,
--    so it needs an INSERT policy, not just UPDATE)
drop policy if exists "Admin can insert tax settings" on public.tax_settings;
create policy "Admin can insert tax settings"
  on public.tax_settings for insert
  to anon, authenticated
  with check (true);

-- 2. Make sure the single settings row exists with the current defaults
--    (does nothing if the row is already there)
insert into public.tax_settings (id)
values (1)
on conflict (id) do nothing;

-- =====================================================================
-- DONE. Open Admin → Tax tab, change a rate, hit Save — it should now
-- persist and show "✓ Tax settings saved".
-- =====================================================================
