-- Add helper function to fetch invite metadata for the invite landing page
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
