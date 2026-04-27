-- Allow household members to update household-level settings such as joint_filing and global_settings

alter table public.households enable row level security;

drop policy if exists household_update on public.households;
create policy household_update on public.households
  for update using (public.is_household_member(id))
  with check (public.is_household_member(id));
