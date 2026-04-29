-- Add mortgage_insurance_monthly column to loans table
alter table public.loans add column if not exists mortgage_insurance_monthly numeric not null default 0;
