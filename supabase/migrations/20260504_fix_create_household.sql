-- Prevent duplicate household creation for the same authenticated user
-- The RPC now returns an existing household if the user already belongs to one.

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
