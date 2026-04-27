-- Ensure household creation RPC exists for app bootstrap.
create or replace function public.create_household(household_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_household_id uuid;
begin
  insert into public.households (name)
  values (household_name)
  returning id into new_household_id;

  insert into public.household_members (household_id, user_id)
  values (new_household_id, auth.uid());

  return new_household_id;
end;
$$;

-- User should always see their own memberships.
drop policy if exists member_read on public.household_members;
create policy member_read on public.household_members
for select using (user_id = auth.uid() or public.is_household_member(household_id));

-- Replace broad invite policy with safer split policies.
drop policy if exists invites_access on public.household_invites;
drop policy if exists invites_select on public.household_invites;
drop policy if exists invites_insert on public.household_invites;
drop policy if exists invites_delete on public.household_invites;
drop policy if exists invites_update on public.household_invites;

-- Household members can create/read/update/delete invites for their household.
create policy invites_select on public.household_invites
for select using (
  public.is_household_member(household_id)
  or lower(email) = lower(coalesce(auth.jwt()->>'email', ''))
);

create policy invites_insert on public.household_invites
for insert with check (public.is_household_member(household_id));

create policy invites_update on public.household_invites
for update using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));

-- Allow deletion by household members, or by the invited user (after accept).
create policy invites_delete on public.household_invites
for delete using (
  public.is_household_member(household_id)
  or lower(email) = lower(coalesce(auth.jwt()->>'email', ''))
);
