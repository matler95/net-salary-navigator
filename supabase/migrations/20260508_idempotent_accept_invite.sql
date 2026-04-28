-- Make accept_invite idempotent.
--
-- Scenario: the RPC succeeds (sets status='accepted', inserts membership) but
-- the HTTP response is dropped before the client receives it. On retry, the
-- old code raised 'Invalid, expired, or already used invite' because status
-- was no longer 'pending'. The fix: when we find a matching accepted invite
-- and the user is already a member, return the household_id as success.
--
-- Also adds auth.email() as fallback for the email check to guard against
-- edge cases where auth.jwt()->>'email' returns NULL.

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
  -- Resolve caller email robustly (jwt claim first, built-in helper as fallback)
  v_caller_email := coalesce(
    nullif(auth.jwt()->>'email', ''),
    auth.email()
  );

  -- Primary path: pending invite for this user
  select household_id into v_household_id
  from public.household_invites
  where token = invite_token
    and status = 'pending'
    and expires_at > now()
    and lower(email) = lower(v_caller_email);

  if v_household_id is null then
    -- Idempotency path: invite was already accepted AND the user is already a member.
    -- Handles the case where the RPC succeeded but the client never received the
    -- response (network drop) and is now retrying.
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
