-- Custom product specs (e.g. الخامة / الوزن / السعة / بلد الصنع) as
-- [{ "name": "...", "value": "..." }]. Additive only: existing products,
-- variants, stock and orders are untouched. The app works before and after
-- this runs (it skips specs until the column exists).
alter table public.products
  add column if not exists attributes jsonb not null default '[]'::jsonb;
