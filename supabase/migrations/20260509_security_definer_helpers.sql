-- Fix "stack depth limit exceeded" on multi-member households.
--
-- is_household_member and is_household_owner are called from RLS policies on
-- both households and household_members. Because they are plain STABLE functions
-- (not SECURITY DEFINER), their inner SELECT on household_members is itself
-- subject to RLS. The member_read policy calls is_household_member for any row
-- where user_id != auth.uid(), which re-enters the same function → infinite
-- recursion → "stack depth limit exceeded".
--
-- Making them SECURITY DEFINER causes the inner query to bypass RLS entirely.
-- auth.uid() still resolves to the calling user's ID (it reads from the session
-- context, not the execution role), so membership checks remain correct.

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
