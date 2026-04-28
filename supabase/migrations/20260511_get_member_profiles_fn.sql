-- Migration: Add security-definer RPC for household member profiles
-- This function joins household_members with auth.users to return member profiles
-- with email and nickname (from user_meta_data) accessible to authenticated users.

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
