-- Add bond data storage table
-- This table stores Polish government bond data fetched from obligacjeskarbowe.pl
-- Data is refreshed monthly and versioned for historical tracking

create table if not exists public.bond_data (
  id uuid primary key default gen_random_uuid(),
  symbol text not null, -- e.g., 'OTS', 'ROR', 'DOR', etc.
  name text not null, -- Full name in Polish
  category text not null, -- 'fixed', 'nbp_indexed', 'cpi_indexed'
  tenor_months integer not null, -- Duration in months

  -- Rate fields (nullable based on category)
  annual_rate_pct numeric, -- For fixed bonds
  nbp_margin_pct numeric, -- For NBP-indexed bonds
  cpi_year1_pct numeric, -- For CPI-indexed bonds (year 1)
  cpi_margin_pct numeric, -- For CPI-indexed bonds (subsequent years)

  -- Penalty fields
  early_redeem_penalty_pct numeric,
  early_redeem_fixed_fee numeric,
  min_hold_months integer,

  -- Metadata
  description text,
  notes text,
  source_url text not null default 'https://www.obligacjeskarbowe.pl/',
  fetched_at timestamptz not null default now(),
  is_active boolean not null default true,

  -- Versioning for historical data
  version integer not null default 1,
  valid_from timestamptz not null default now(),
  valid_to timestamptz,

  created_at timestamptz not null default now(),

  -- Constraints
  constraint bond_data_category_check check (category in ('fixed', 'nbp_indexed', 'cpi_indexed'))
);

-- Indexes for performance
create index if not exists idx_bond_data_symbol on public.bond_data(symbol);
create index if not exists idx_bond_data_category on public.bond_data(category);
create index if not exists idx_bond_data_active on public.bond_data(is_active) where is_active = true;
create index if not exists idx_bond_data_fetched_at on public.bond_data(fetched_at desc);

-- Partial unique index to ensure only one active record per symbol
create unique index if not exists idx_bond_data_symbol_active_unique on public.bond_data(symbol) where is_active = true;
create index if not exists idx_bond_data_valid_from on public.bond_data(valid_from desc);

-- Table for storing global economic indicators
create table if not exists public.economic_indicators (
  id uuid primary key default gen_random_uuid(),
  indicator_type text not null, -- 'nbp_reference_rate', 'cpi_estimate'
  value numeric not null,
  unit text not null default '%', -- percentage by default
  source_url text not null default 'https://www.obligacjeskarbowe.pl/',
  fetched_at timestamptz not null default now(),
  is_active boolean not null default true,
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  created_at timestamptz not null default now(),

  constraint economic_indicators_type_check check (indicator_type in ('nbp_reference_rate', 'cpi_estimate'))
);

-- Insert initial data (current hardcoded values)
insert into public.bond_data (
  symbol, name, category, tenor_months, annual_rate_pct, nbp_margin_pct,
  cpi_year1_pct, cpi_margin_pct, early_redeem_penalty_pct, early_redeem_fixed_fee,
  min_hold_months, description, notes
) values
  ('OTS', '3-miesięczne oszczędnościowe', 'fixed', 3, 5.0, null, null, null, 100, null, 1,
   'Stałe oprocentowanie przez cały okres. Brak możliwości wcześniejszego wykupu przed upływem 1 m-ca.',
   'Najkrótszy dostępny instrument. Idealne dla płynności.'),
  ('ROR', '12-miesięczne (stopa NBP)', 'nbp_indexed', 12, null, 0.0, null, null, null, 0.5, 1,
   'Oprocentowanie = stopa referencyjna NBP. Odsetki naliczane miesięcznie.',
   'Zmiana stopy NBP przekłada się na oprocentowanie od następnego miesiąca.'),
  ('DOR', '2-letnie (stopa NBP)', 'nbp_indexed', 24, null, 0.25, null, null, null, 0.7, 1,
   'Oprocentowanie = stopa NBP + 0,25 p.p. Odsetki naliczane miesięcznie, wypłacane co miesiąc.',
   'Lepsza marża niż ROR przy dłuższym zaangażowaniu.'),
  ('TOS', '3-letnie stałoprocentowe', 'fixed', 36, 6.2, null, null, null, null, 0.7, 1,
   'Stałe 6,2% przez 3 lata, odsetki kapitalizowane rocznie.',
   'Chronią przed obniżkami stóp NBP.'),
  ('COI', '4-letnie (inflacja CPI)', 'cpi_indexed', 48, null, null, 4.75, 1.5, null, 0.7, 1,
   'Rok 1: 4,75% stałe. Lata 2-4: inflacja CPI + 1,50 p.p. Odsetki wypłacane co roku. Brak kapitalizacji odsetek.',
   'Ochrona przed inflacją od roku 2.'),
  ('EDO', '10-letnie (inflacja CPI)', 'cpi_indexed', 120, null, null, 7.0, 1.5, null, 2.0, 1,
   'Rok 1: 7,0% stałe. Lata 2-10: inflacja CPI + 1,5 p.p. Odsetki kapitalizowane.',
   'Kapitalizacja odsetek = najlepszy efekt procenta składanego przy długim horyzoncie.')
on conflict do nothing;

-- Insert initial economic indicators
insert into public.economic_indicators (indicator_type, value, unit) values
  ('nbp_reference_rate', 5.75, '%'),
  ('cpi_estimate', 4.5, '%')
on conflict do nothing;

-- RLS policies (read access for all authenticated users)
alter table public.bond_data enable row level security;
alter table public.economic_indicators enable row level security;

create policy "Allow read access to bond_data" on public.bond_data
  for select using (auth.role() = 'authenticated');

create policy "Allow read access to economic_indicators" on public.economic_indicators
  for select using (auth.role() = 'authenticated');

-- Indexes for economic_indicators
create index if not exists idx_economic_indicators_type on public.economic_indicators(indicator_type);
create index if not exists idx_economic_indicators_active on public.economic_indicators(is_active) where is_active = true;
create index if not exists idx_economic_indicators_fetched_at on public.economic_indicators(fetched_at desc);

-- Partial unique index to ensure only one active record per indicator type
create unique index if not exists idx_economic_indicators_type_active_unique on public.economic_indicators(indicator_type) where is_active = true;

-- Function to get latest active bond data
create or replace function public.get_latest_bond_data()
returns table (
  symbol text,
  name text,
  category text,
  tenor_months integer,
  annual_rate_pct numeric,
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

-- Function to get latest economic indicators
create or replace function public.get_latest_economic_indicators()
returns table (
  indicator_type text,
  value numeric,
  unit text,
  fetched_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    ei.indicator_type,
    ei.value,
    ei.unit,
    ei.fetched_at
  from public.economic_indicators ei
  where ei.is_active = true;
$$;