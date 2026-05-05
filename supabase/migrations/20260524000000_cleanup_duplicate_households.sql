-- Remove duplicate empty households created before the household creation guard.
-- Only removes households with exactly one member, no related household data,
-- no pending invites, and a member who belongs to another household.

with empty_duplicate_households as (
  select h.id
  from public.households h
  join public.household_members hm on hm.household_id = h.id
  where not exists (select 1 from public.spouses s where s.household_id = h.id)
    and not exists (select 1 from public.expenses e where e.household_id = h.id)
    and not exists (select 1 from public.investments i where i.household_id = h.id)
    and not exists (select 1 from public.loans l where l.household_id = h.id)
    and not exists (select 1 from public.rentals r where r.household_id = h.id)
    and not exists (select 1 from public.savings sa where sa.household_id = h.id)
    and not exists (select 1 from public.household_invites inv where inv.household_id = h.id and inv.status = 'pending')
  group by h.id, hm.user_id
  having count(*) = 1
    and exists (
      select 1
      from public.household_members hm2
      where hm2.user_id = hm.user_id
      and hm2.household_id <> h.id
    )
)

delete from public.households h
using empty_duplicate_households edh
where h.id = edh.id;
