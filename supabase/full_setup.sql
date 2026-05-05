-- Combined Supabase Migration Script for Placa.netto
-- This script sets up the entire schema, including missing columns and realtime.
-- Run this in the Supabase SQL Editor.

create extension if not exists "pgcrypto";

-- 1. TABLES
create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  joint_filing boolean not null default false,
  global_settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create table if not exists public.household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  email text not null,
  token text not null unique,
  status text not null default 'pending',
  expires_at timestamptz not null default (now() + interval '7 day'),
  created_at timestamptz not null default now(),
  constraint household_invites_status_check check (status in ('pending', 'accepted', 'revoked'))
);

create unique index if not exists idx_invites_household_email_active
  on public.household_invites(household_id, lower(email))
  where status = 'pending';

create table if not exists public.spouses (
  id text primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  inputs jsonb not null default '{}'::jsonb,
  assigned_user_id uuid references auth.users(id) on delete set null,
  age integer,
  gender text,
  existing_ike_balance numeric,
  existing_ikze_balance numeric,
  ikze_limit_type text,
  prior_retirement_contribution_years integer,
  created_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id text primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  category text not null,
  label text not null,
  amount numeric not null default 0,
  frequency text not null default 'monthly',
  month integer,
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
  payment_day_of_month integer,
  last_payment_date text,
  mortgage_insurance_monthly numeric not null default 0,
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

create table if not exists public.savings (
  id text primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  bank text not null,
  type text not null default 'zwykłe',
  balance numeric not null default 0,
  rate_pct numeric not null default 0,
  lokata_start_date text,
  lokata_duration_months integer,
  lokata_capitalization text,
  created_at timestamptz not null default now()
);

-- 2. ENSURE COLUMNS (for existing databases)
alter table public.households add column if not exists joint_filing boolean not null default false;
alter table public.households add column if not exists global_settings jsonb not null default '{}'::jsonb;
alter table public.household_members add column if not exists role text not null default 'member';
alter table public.spouses add column if not exists age integer;
alter table public.spouses add column if not exists gender text;
alter table public.spouses add column if not exists existing_ike_balance numeric;
alter table public.spouses add column if not exists existing_ikze_balance numeric;
alter table public.spouses add column if not exists ikze_limit_type text;
alter table public.spouses add column if not exists prior_retirement_contribution_years integer;
update public.spouses
set ikze_limit_type = 'standard'
where ikze_limit_type is null;
alter table public.spouses alter column ikze_limit_type set default 'standard';
update public.spouses
set prior_retirement_contribution_years = 0
where prior_retirement_contribution_years is null;
alter table public.spouses alter column prior_retirement_contribution_years set default 0;
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'spouses_ikze_limit_type_check'
  ) then
    alter table public.spouses
      add constraint spouses_ikze_limit_type_check
      check (ikze_limit_type in ('standard', 'b2b'));
  end if;
end
$$;
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'spouses_prior_retirement_years_check'
  ) then
    alter table public.spouses
      add constraint spouses_prior_retirement_years_check
      check (prior_retirement_contribution_years >= 0);
  end if;
end
$$;
alter table public.expenses add column if not exists month integer;
alter table public.loans add column if not exists payment_day_of_month integer;
alter table public.loans add column if not exists last_payment_date text;
alter table public.loans add column if not exists mortgage_insurance_monthly numeric not null default 0;
alter table public.savings add column if not exists lokata_start_date text;
alter table public.savings add column if not exists lokata_duration_months integer;
alter table public.savings add column if not exists lokata_capitalization text;
alter table public.spouses drop constraint if exists spouses_assigned_user_id_fkey;
alter table public.spouses add constraint spouses_assigned_user_id_fkey
  foreign key (assigned_user_id) references auth.users(id) on delete set null;

-- 3. INDEXES
create index if not exists idx_household_members_user on public.household_members(user_id);
create index if not exists idx_spouses_household on public.spouses(household_id);
create index if not exists idx_expenses_household on public.expenses(household_id);
create index if not exists idx_investments_household on public.investments(household_id);
create index if not exists idx_loans_household on public.loans(household_id);
create index if not exists idx_rentals_household on public.rentals(household_id);
create index if not exists idx_savings_household on public.savings(household_id);

-- 4. FUNCTIONS
create or replace function public.is_household_member(target_household uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.household_members hm
    where hm.household_id = target_household
      and hm.user_id = auth.uid()
  );
$$;

create or replace function public.is_household_owner(target_household uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.household_members hm
    where hm.household_id = target_household
      and hm.user_id = auth.uid()
      and hm.role = 'owner'
  );
$$;

-- Create a household and add the creator as a member in one go
-- This bypasses the RLS issue where a user cannot select a household they just created
-- because they aren't yet in the household_members table.
create or replace function public.create_household(household_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_household_id uuid;
  existing_household_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext(auth.uid()::text), 0);

  select household_id into existing_household_id
  from public.household_members
  where user_id = auth.uid()
  limit 1;

  if existing_household_id is not null then
    return existing_household_id;
  end if;

  insert into public.households (name)
  values (household_name)
  returning id into new_household_id;

  insert into public.household_members (household_id, user_id, role)
  values (new_household_id, auth.uid(), 'owner');

  return new_household_id;
end;
$$;

-- Accept an invite atomically: validate, insert membership, mark accepted.
-- Idempotent: retrying after a network drop (invite already accepted + user
-- is already a member) returns the household_id instead of raising.
create or replace function public.accept_invite(invite_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household_id uuid;
  v_caller_email text;
begin
  v_caller_email := coalesce(
    nullif(auth.jwt()->>'email', ''),
    auth.email()
  );

  select household_id into v_household_id
  from public.household_invites
  where token = invite_token
    and status = 'pending'
    and expires_at > now()
    and lower(email) = lower(v_caller_email);

  if v_household_id is null then
    select hi.household_id into v_household_id
    from public.household_invites hi
    where hi.token = invite_token
      and hi.status = 'accepted'
      and lower(hi.email) = lower(v_caller_email)
      and exists (
        select 1 from public.household_members hm
        where hm.household_id = hi.household_id
          and hm.user_id = auth.uid()
      );

    if v_household_id is not null then
      return v_household_id;
    end if;

    raise exception 'Invalid, expired, or already used invite';
  end if;

  insert into public.household_members (household_id, user_id, role)
  values (v_household_id, auth.uid(), 'member')
  on conflict (household_id, user_id) do nothing;

  update public.household_invites
  set status = 'accepted'
  where token = invite_token;

  return v_household_id;
end;
$$;

create or replace function public.get_invite_context(invite_token text)
returns table(
  household_id uuid,
  household_name text,
  email text,
  status text,
  expires_at timestamptz,
  is_valid boolean
)
language sql
security definer
set search_path = public
as $$
  select
    hi.household_id,
    h.name as household_name,
    hi.email,
    hi.status,
    hi.expires_at,
    (hi.status = 'pending' and hi.expires_at > now()) as is_valid
  from public.household_invites hi
  join public.households h on h.id = hi.household_id
  where hi.token = invite_token;
$$;

create or replace function public.get_household_member_profiles(target_household uuid)
returns table(user_id uuid, email text, nickname text, role text)
language sql
security definer
set search_path = public
as $$
  select
    hm.user_id,
    au.email,
    au.raw_user_meta_data->>'nickname' as nickname,
    hm.role
  from public.household_members hm
  join auth.users au on au.id = hm.user_id
  where hm.household_id = target_household
    and public.is_household_member(target_household);
$$;

-- 5. SECURITY (RLS)
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_invites enable row level security;
alter table public.spouses enable row level security;
alter table public.expenses enable row level security;
alter table public.investments enable row level security;
alter table public.loans enable row level security;
alter table public.rentals enable row level security;
alter table public.savings enable row level security;

-- Policies
do $$
begin
    drop policy if exists household_read on public.households;
    create policy household_read on public.households for select using (public.is_household_member(id));
    
    drop policy if exists household_insert on public.households;
    create policy household_insert on public.households for insert with check (auth.uid() is not null);
    
    drop policy if exists member_read on public.household_members;
    create policy member_read on public.household_members for select using (user_id = auth.uid() or public.is_household_member(household_id));
    
    drop policy if exists member_insert on public.household_members;
    -- Deny direct API inserts; all membership creation goes through security definer RPCs
    create policy member_insert on public.household_members for insert with check (false);
    
    drop policy if exists member_delete on public.household_members;
    create policy member_delete on public.household_members for delete using (public.is_household_member(household_id) or user_id = auth.uid());
    
    drop policy if exists invites_access on public.household_invites;
    drop policy if exists invites_select on public.household_invites;
    drop policy if exists invites_insert on public.household_invites;
    drop policy if exists invites_update on public.household_invites;
    drop policy if exists invites_delete on public.household_invites;
    create policy invites_select on public.household_invites
    for select using (
      public.is_household_owner(household_id)
      or lower(email) = lower(coalesce(auth.jwt()->>'email', ''))
    );
    create policy invites_insert on public.household_invites
    for insert with check (public.is_household_member(household_id));
    create policy invites_update on public.household_invites
    for update using (public.is_household_member(household_id))
    with check (public.is_household_member(household_id));
    create policy invites_delete on public.household_invites
    for delete using (
      public.is_household_member(household_id)
      or lower(email) = lower(coalesce(auth.jwt()->>'email', ''))
    );
    
    drop policy if exists spouses_access on public.spouses;
    create policy spouses_access on public.spouses for all using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
    
    drop policy if exists expenses_access on public.expenses;
    create policy expenses_access on public.expenses for all using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
    
    drop policy if exists investments_access on public.investments;
    create policy investments_access on public.investments for all using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
    
    drop policy if exists loans_access on public.loans;
    create policy loans_access on public.loans for all using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
    
    drop policy if exists rentals_access on public.rentals;
    create policy rentals_access on public.rentals for all using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
    
    drop policy if exists savings_access on public.savings;
    create policy savings_access on public.savings for all using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
end $$;

-- 6. REALTIME
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
