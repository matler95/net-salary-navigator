create extension if not exists "pgcrypto";

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create table if not exists public.household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  email text not null,
  token text not null unique,
  expires_at timestamptz not null default (now() + interval '7 day'),
  created_at timestamptz not null default now()
);

create table if not exists public.spouses (
  id text primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  inputs jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id text primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  category text not null,
  label text not null,
  amount numeric not null default 0,
  frequency text not null default 'monthly',
  created_at timestamptz not null default now()
);

create table if not exists public.investments (
  id text primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  label text not null,
  type text not null,
  currency text not null default 'PLN',
  ticker text,
  volume numeric not null default 0,
  ticker_price_at_add numeric not null default 0,
  ticker_price_date text,
  value numeric not null default 0,
  monthly_contribution numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.loans (
  id text primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  label text not null,
  principal numeric not null default 0,
  annual_rate_pct numeric not null default 0,
  months_remaining integer not null default 0,
  monthly_overpayment numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.rentals (
  id text primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  label text not null,
  monthly_rent numeric not null default 0,
  monthly_costs numeric not null default 0,
  monthly_mortgage numeric not null default 0,
  vacancy_rate_pct numeric not null default 0,
  tax_rate_pct numeric not null default 8.5,
  market_value numeric not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_household_members_user on public.household_members(user_id);
create index if not exists idx_spouses_household on public.spouses(household_id);
create index if not exists idx_expenses_household on public.expenses(household_id);
create index if not exists idx_investments_household on public.investments(household_id);
create index if not exists idx_loans_household on public.loans(household_id);
create index if not exists idx_rentals_household on public.rentals(household_id);

create or replace function public.is_household_member(target_household uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.household_members hm
    where hm.household_id = target_household
      and hm.user_id = auth.uid()
  );
$$;

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_invites enable row level security;
alter table public.spouses enable row level security;
alter table public.expenses enable row level security;
alter table public.investments enable row level security;
alter table public.loans enable row level security;
alter table public.rentals enable row level security;

drop policy if exists household_read on public.households;
create policy household_read on public.households
for select using (public.is_household_member(id));

drop policy if exists household_insert on public.households;
create policy household_insert on public.households
for insert with check (auth.uid() is not null);

drop policy if exists member_read on public.household_members;
create policy member_read on public.household_members
for select using (public.is_household_member(household_id));

drop policy if exists member_insert on public.household_members;
create policy member_insert on public.household_members
for insert with check (public.is_household_member(household_id) or user_id = auth.uid());

drop policy if exists member_delete on public.household_members;
create policy member_delete on public.household_members
for delete using (public.is_household_member(household_id) or user_id = auth.uid());

drop policy if exists invites_access on public.household_invites;
create policy invites_access on public.household_invites
for all using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));

drop policy if exists spouses_access on public.spouses;
create policy spouses_access on public.spouses
for all using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));

drop policy if exists expenses_access on public.expenses;
create policy expenses_access on public.expenses
for all using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));

drop policy if exists investments_access on public.investments;
create policy investments_access on public.investments
for all using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));

drop policy if exists loans_access on public.loans;
create policy loans_access on public.loans
for all using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));

drop policy if exists rentals_access on public.rentals;
create policy rentals_access on public.rentals
for all using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));
