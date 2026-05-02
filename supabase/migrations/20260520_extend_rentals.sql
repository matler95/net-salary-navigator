alter table public.rentals
  add column if not exists purchase_price numeric default 0,
  add column if not exists purchase_date text,
  add column if not exists renovation_cost numeric default 0,
  add column if not exists closing_costs_pct numeric default 2.5,
  add column if not exists linked_loan_id text,
  add column if not exists mortgage_rate_pct numeric,
  add column if not exists mortgage_years integer,
  add column if not exists mortgage_remaining_months integer,
  add column if not exists mortgage_insurance_monthly numeric default 0,
  add column if not exists appreciation_pct numeric default 4,
  add column if not exists rent_growth_pct numeric default 3,
  add column if not exists vacancy_months_per_year numeric default 0;
