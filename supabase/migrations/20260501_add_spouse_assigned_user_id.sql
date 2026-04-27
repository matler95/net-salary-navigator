alter table public.spouses
  add column if not exists assigned_user_id uuid references auth.users(id);
