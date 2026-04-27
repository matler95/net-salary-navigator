-- Add missing columns to households table
alter table public.households add column if not exists joint_filing boolean not null default false;
alter table public.households add column if not exists global_settings jsonb not null default '{}'::jsonb;

-- Add missing columns to expenses table
alter table public.expenses add column if not exists month integer;

-- Add missing columns to loans table
alter table public.loans add column if not exists "paymentDayOfMonth" integer;
alter table public.loans add column if not exists "lastPaymentDate" text;

-- Create or update savings table with all required columns
create table if not exists public.savings (
  id text primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  bank text not null,
  type text not null default 'zwykłe',
  balance numeric not null default 0,
  ratePct numeric not null default 0,
  "lokataStartDate" text,
  "lokataDurationMonths" integer,
  "lokataCapitalization" text,
  created_at timestamptz not null default now()
);

-- Enable RLS and add policies for savings
alter table public.savings enable row level security;

create index if not exists idx_savings_household on public.savings(household_id);

drop policy if exists savings_access on public.savings;
create policy savings_access on public.savings
for all using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));

-- Enable Realtime for all data tables
-- Note: We wrap in a block to ignore errors if they are already in the publication
do $$
begin
  alter publication supabase_realtime add table public.households;
exception when others then null; end $$;

do $$
begin
  alter publication supabase_realtime add table public.spouses;
exception when others then null; end $$;

do $$
begin
  alter publication supabase_realtime add table public.expenses;
exception when others then null; end $$;

do $$
begin
  alter publication supabase_realtime add table public.investments;
exception when others then null; end $$;

do $$
begin
  alter publication supabase_realtime add table public.loans;
exception when others then null; end $$;

do $$
begin
  alter publication supabase_realtime add table public.rentals;
exception when others then null; end $$;

do $$
begin
  alter publication supabase_realtime add table public.savings;
exception when others then null; end $$;
