
-- Update retirement limits with official 2026 values and ensure previous years are correct
insert into public.retirement_limits (year, ike_limit, ikze_limit, ikze_b2b_limit)
values 
  (2024, 23472, 9388.80, 14083.20),
  (2025, 26019, 10407.60, 15611.40),
  (2026, 28260, 11304.00, 16956.00)
on conflict (year) do update set
  ike_limit = excluded.ike_limit,
  ikze_limit = excluded.ikze_limit,
  ikze_b2b_limit = excluded.ikze_b2b_limit;

-- Refresh PostgREST cache
NOTIFY pgrst, 'reload schema';
