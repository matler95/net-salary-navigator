-- Change assigned_user_id FK to ON DELETE SET NULL so that removing a
-- household member (or deleting a user) does not break the spouses table.
-- Also clean up any rows that already point to non-existent auth users.

alter table public.spouses
  drop constraint if exists spouses_assigned_user_id_fkey;

alter table public.spouses
  add constraint spouses_assigned_user_id_fkey
    foreign key (assigned_user_id) references auth.users(id) on delete set null;

update public.spouses
set assigned_user_id = null
where assigned_user_id is not null
  and not exists (
    select 1 from auth.users u where u.id = spouses.assigned_user_id
  );
