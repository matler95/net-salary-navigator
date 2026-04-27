-- Add missing columns to households table
alter table public.households add column if not exists joint_filing boolean not null default false;
alter table public.households add column if not exists global_settings jsonb not null default '{}'::jsonb;

-- Create missing savings table
create table if not exists public.savings (
  id text primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  bank text not null,
  type text not null default 'zwykłe',
  balance numeric not null default 0,
  ratePct numeric not null default 0,
  created_at timestamptz not null default now()
);

-- Enable RLS and add policies for savings
alter table public.savings enable row level security;

create index if not exists idx_savings_household on public.savings(household_id);

drop policy if exists savings_access on public.savings;
create policy savings_access on public.savings
for all using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));
