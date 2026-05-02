-- Add total_cost_pln column to investments table
-- This column stores the total cost in PLN at the time of adding the investment

alter table public.investments
add column if not exists total_cost_pln numeric not null default 0;