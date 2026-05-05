
-- Repair migration to ensure all required columns exist in public.spouses
alter table public.spouses add column if not exists age integer;
alter table public.spouses add column if not exists gender text;
alter table public.spouses add column if not exists existing_ike_balance numeric;
alter table public.spouses add column if not exists existing_ikze_balance numeric;
alter table public.spouses add column if not exists ikze_limit_type text;
alter table public.spouses add column if not exists prior_retirement_contribution_years integer;

-- Ensure defaults
alter table public.spouses alter column ikze_limit_type set default 'standard';
alter table public.spouses alter column prior_retirement_contribution_years set default 0;

-- Refresh PostgREST cache
NOTIFY pgrst, 'reload schema';
