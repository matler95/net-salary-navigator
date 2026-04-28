-- Sharing refactor: invite status, safer invite policies, ownership transfers, and realtime publication

-- 1. Invite status and active invite uniqueness
alter table public.household_invites add column if not exists status text not null default 'pending';
alter table public.household_invites add constraint household_invites_status_check check (status in ('pending', 'accepted', 'revoked'));

drop index if exists idx_invites_household_email;
create unique index if not exists idx_invites_household_email_active
  on public.household_invites(household_id, lower(email))
  where status = 'pending';

-- 2. Owner helper function
create or replace function public.is_household_owner(target_household uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.household_members hm
    where hm.household_id = target_household
      and hm.user_id = auth.uid()
      and hm.role = 'owner'
  );
$$;

-- 3. Accept / revoke invite RPCs
create or replace function public.accept_invite(invite_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household_id uuid;
begin
  select household_id into v_household_id
  from public.household_invites
  where token = invite_token
    and expires_at > now()
    and status = 'pending'
    and lower(email) = lower(auth.jwt()->>'email');

  if v_household_id is null then
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

create or replace function public.revoke_invite(invite_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.household_invites
  set status = 'revoked'
  where id = invite_id
    and public.is_household_owner(household_id);
end;
$$;

-- 4. Leave and transfer ownership RPCs
create or replace function public.leave_household(target_household_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_member_count int;
begin
  select role into v_role
  from public.household_members
  where household_id = target_household_id and user_id = auth.uid();

  if v_role is null then
    raise exception 'Not a member of this household';
  end if;

  select count(*) into v_member_count
  from public.household_members
  where household_id = target_household_id;

  if v_role = 'owner' and v_member_count > 1 then
    raise exception 'Transfer ownership before leaving';
  end if;

  delete from public.household_members
  where household_id = target_household_id and user_id = auth.uid();
end;
$$;

create or replace function public.transfer_ownership(
  target_household_id uuid,
  new_owner_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.household_members
    where household_id = target_household_id
      and user_id = auth.uid()
      and role = 'owner'
  ) then
    raise exception 'Only the owner can transfer ownership';
  end if;

  update public.household_members
  set role = 'member'
  where household_id = target_household_id and user_id = auth.uid();

  update public.household_members
  set role = 'owner'
  where household_id = target_household_id and user_id = new_owner_id;
end;
$$;

-- 5. Safer invite policies
alter table public.household_invites enable row level security;

drop policy if exists invites_select on public.household_invites;
create policy invites_select on public.household_invites
for select using (
  public.is_household_owner(household_id)
  or lower(email) = lower(coalesce(auth.jwt()->>'email', ''))
);

drop policy if exists invites_update on public.household_invites;
create policy invites_update on public.household_invites
for update using (public.is_household_owner(household_id))
with check (public.is_household_owner(household_id));

drop policy if exists invites_delete on public.household_invites;
create policy invites_delete on public.household_invites
for delete using (
  public.is_household_owner(household_id)
  or lower(email) = lower(coalesce(auth.jwt()->>'email', ''))
);

-- 6. Realtime publication
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.household_members;
EXCEPTION WHEN others THEN null; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.household_invites;
EXCEPTION WHEN others THEN null; END $$;
