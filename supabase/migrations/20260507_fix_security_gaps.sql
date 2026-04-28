-- Fix security gaps identified in invite flow and RLS policies.

-- 1. Deny direct API inserts into household_members.
--    All membership creation goes through security definer RPCs (create_household,
--    accept_invite) which bypass RLS, so denying direct inserts is safe and prevents
--    any authenticated user from adding arbitrary members without an invite.
drop policy if exists member_insert on public.household_members;
create policy member_insert on public.household_members for insert with check (false);
