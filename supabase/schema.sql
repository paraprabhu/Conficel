-- ConfiCel profile foundation. Run in Supabase SQL Editor for project oegrnllhamojuxvuedva.
-- This stores profile metadata only; it does NOT enforce document conversion quotas yet.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  plan text not null default 'free' check (plan in ('free','standard','scale')),
  invoices_used integer not null default 0 check (invoices_used >= 0),
  cheques_used integer not null default 0 check (cheques_used >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;

 drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile" on public.profiles
  for select to authenticated using (auth.uid() = id);

-- No client insert/update policy: profile rows and entitlements are managed by this trigger.
create or replace function public.handle_new_conficel_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, plan, invoices_used, cheques_used)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name',''), 'free', 0, 0)
  on conflict (id) do nothing;
  return new;
end;
$$;

 drop trigger if exists on_auth_user_created_conficel on auth.users;
create trigger on_auth_user_created_conficel
after insert on auth.users
for each row execute procedure public.handle_new_conficel_user();
