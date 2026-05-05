alter table public.spouses add column if not exists age integer;
alter table public.spouses add column if not exists gender text;
alter table public.spouses add column if not exists existing_ike_balance numeric;
alter table public.spouses add column if not exists existing_ikze_balance numeric;
alter table public.spouses add column if not exists ikze_limit_type text;
alter table public.spouses add column if not exists prior_retirement_contribution_years integer;

-- Ensure legacy rows get a valid default profile.
update public.spouses
set ikze_limit_type = 'standard'
where ikze_limit_type is null;

alter table public.spouses
  alter column ikze_limit_type set default 'standard';
alter table public.spouses
  alter column prior_retirement_contribution_years set default 0;

update public.spouses
set prior_retirement_contribution_years = 0
where prior_retirement_contribution_years is null;

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
