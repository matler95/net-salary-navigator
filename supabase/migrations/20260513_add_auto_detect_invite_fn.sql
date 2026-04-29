-- Add helper function to fetch a pending invite for the currently authenticated user
-- This allows the UI to automatically detect invitations when a user logs in
create or replace function public.get_pending_invite_for_user()
returns table(
  id uuid,
  token text,
  household_id uuid,
  household_name text,
  email text,
  status text,
  expires_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    hi.id,
    hi.token,
    hi.household_id,
    h.name as household_name,
    hi.email,
    hi.status,
    hi.expires_at
  from public.household_invites hi
  join public.households h on h.id = hi.household_id
  where hi.email = auth.jwt()->>'email'
    and hi.status = 'pending'
    and hi.expires_at > now()
  limit 1;
$$;
