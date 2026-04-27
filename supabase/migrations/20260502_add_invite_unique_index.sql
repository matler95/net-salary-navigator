-- Add unique index on household_invites to prevent duplicate invites for same household+email
-- Note: This prevents duplicates for all invites, including expired ones. 
-- The application should handle expiration checks.
create unique index if not exists idx_invites_household_email
on public.household_invites(household_id, lower(email));