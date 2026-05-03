-- Add nbp_month1_pct column to bond_data table
-- This stores the fixed first-month/first-period rate for NBP-indexed bonds (ROR, DOR)
-- before they switch to the variable NBP reference rate

alter table public.bond_data 
  add column if not exists nbp_month1_pct numeric;

comment on column public.bond_data.nbp_month1_pct is 
  'For NBP-indexed bonds: the fixed rate for month 1 before switching to NBP + margin';

-- Update the upsert function to include nbp_month1_pct
create or replace function public.upsert_bond_data(
  p_symbol        text,
  p_name          text,
  p_category      text,
  p_tenor_months  integer,
  p_annual_rate   numeric,
  p_nbp_month1    numeric,
  p_nbp_margin    numeric,
  p_cpi_year1     numeric,
  p_cpi_margin    numeric,
  p_penalty_pct   numeric,
  p_fixed_fee     numeric,
  p_min_hold      integer,
  p_description   text,
  p_notes         text,
  p_fetched_at    timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
begin
  -- Deactivate only the OLD record for this symbol (not all bonds at once)
  update public.bond_data
  set    is_active = false,
         valid_to  = v_now
  where  symbol    = p_symbol
    and  is_active = true;

  -- Insert the fresh record
  insert into public.bond_data (
    symbol, name, category, tenor_months,
    annual_rate_pct, nbp_month1_pct, nbp_margin_pct, cpi_year1_pct, cpi_margin_pct,
    early_redeem_penalty_pct, early_redeem_fixed_fee, min_hold_months,
    description, notes,
    fetched_at, is_active, valid_from, version
  ) values (
    p_symbol, p_name, p_category, p_tenor_months,
    p_annual_rate, p_nbp_month1, p_nbp_margin, p_cpi_year1, p_cpi_margin,
    p_penalty_pct, p_fixed_fee, p_min_hold,
    p_description, p_notes,
    coalesce(p_fetched_at, v_now), true, v_now, 1
  );
end;
$$;

-- Drop and recreate get_latest_bond_data to add nbp_month1_pct to its return type.
-- PostgreSQL does not allow CREATE OR REPLACE to change the return signature of an existing function.
drop function if exists public.get_latest_bond_data();

create or replace function public.get_latest_bond_data()
returns table (
  symbol text,
  name text,
  category text,
  tenor_months integer,
  annual_rate_pct numeric,
  nbp_month1_pct numeric,
  nbp_margin_pct numeric,
  cpi_year1_pct numeric,
  cpi_margin_pct numeric,
  early_redeem_penalty_pct numeric,
  early_redeem_fixed_fee numeric,
  min_hold_months integer,
  description text,
  notes text,
  fetched_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    bd.symbol,
    bd.name,
    bd.category,
    bd.tenor_months,
    bd.annual_rate_pct,
    bd.nbp_month1_pct,
    bd.nbp_margin_pct,
    bd.cpi_year1_pct,
    bd.cpi_margin_pct,
    bd.early_redeem_penalty_pct,
    bd.early_redeem_fixed_fee,
    bd.min_hold_months,
    bd.description,
    bd.notes,
    bd.fetched_at
  from public.bond_data bd
  where bd.is_active = true
  order by bd.symbol;
$$;

-- Upsert correct May 2026 emission data (idempotent — safe to run multiple times)
-- This ensures even if Supabase has stale seed data, the correct values are always available.
select public.upsert_bond_data(
  'OTS', '3-miesięczne oszczędnościowe', 'fixed', 3,
  2.00, null, null, null, null,    -- annual_rate=2%, no nbp/cpi fields
  100, null, 1,                    -- penalty=100% of interest (all lost), no fixed fee
  'Stałe oprocentowanie przez cały okres.',
  'Najkrótszy dostępny instrument. Idealne dla płynności.',
  now()
);

select public.upsert_bond_data(
  'ROR', '12-miesięczne (stopa NBP)', 'nbp_indexed', 12,
  null, 4.00, 0.00, null, null,   -- nbp_month1=4.00%, margin=0%
  null, 0.50, 1,                  -- fixed fee 0.50 zł
  'Miesiąc 1: stałe 4,00%. Kolejne miesiące: stopa referencyjna NBP.',
  'Odsetki wypłacane co miesiąc. Zmiana stopy NBP od miesiąca 2.',
  now()
);

select public.upsert_bond_data(
  'DOR', '2-letnie (stopa NBP)', 'nbp_indexed', 24,
  null, 4.15, 0.15, null, null,  -- nbp_month1=4.15%, margin=+0.15%
  null, 0.70, 1,                 -- fixed fee 0.70 zł
  'Miesiąc 1: stałe 4,15%. Kolejne miesiące: stopa NBP + 0,15 p.p.',
  'Odsetki wypłacane co miesiąc. Lepsza marża niż ROR.',
  now()
);

select public.upsert_bond_data(
  'TOS', '3-letnie stałoprocentowe', 'fixed', 36,
  4.40, null, null, null, null,  -- annual_rate=4.40%
  null, 1.00, 1,                 -- fixed fee 1.00 zł
  'Stałe 4,40% przez 3 lata. Odsetki kapitalizowane rocznie, wypłacane w dniu wykupu.',
  'Chroni przed obniżkami stóp NBP. Zysk znany z góry.',
  now()
);

select public.upsert_bond_data(
  'COI', '4-letnie (inflacja CPI)', 'cpi_indexed', 48,
  null, null, null, 4.75, 1.50, -- cpi_year1=4.75%, margin=+1.50%
  null, 2.00, 1,                 -- fixed fee 2.00 zł (new emissions from Sep 2024)
  'Rok 1: stałe 4,75%. Lata 2-4: inflacja CPI + 1,50 p.p. Odsetki wypłacane co roku.',
  'Ochrona przed inflacją od roku 2. Brak kapitalizacji.',
  now()
);

select public.upsert_bond_data(
  'EDO', '10-letnie (inflacja CPI)', 'cpi_indexed', 120,
  null, null, null, 5.35, 2.00, -- cpi_year1=5.35%, margin=+2.00%
  null, 3.00, 1,                 -- fixed fee 3.00 zł
  'Rok 1: stałe 5,35%. Lata 2-10: inflacja CPI + 2,00 p.p. Odsetki kapitalizowane rocznie.',
  'Najlepsza ochrona przed inflacją. Kapitalizacja = procent składany.',
  now()
);

-- Update economic indicators to current May 2026 values
select public.upsert_economic_indicator('nbp_reference_rate', 4.00, now());
select public.upsert_economic_indicator('cpi_estimate', 4.90, now());
