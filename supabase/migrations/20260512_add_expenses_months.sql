-- Add months array column to expenses table to support multi-month tracking
alter table public.expenses add column if not exists months integer[];
