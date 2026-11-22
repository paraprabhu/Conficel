-- Fix the profile plan constraint for international one-time checkout.
-- Apply on Production Supabase after migration 008.
-- Existing Indian plans remain valid; international plans store their tier label
-- (starter, standard, professional, business) in profiles.plan.

alter table public.profiles
  drop constraint if exists profiles_plan_check;

alter table public.profiles
  add constraint profiles_plan_check
  check (plan in ('free','standard','scale','starter','professional','business'));
