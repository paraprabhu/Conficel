-- One-use, short-lived authorization permits for paid extraction requests.
create table if not exists public.extraction_permits (
  jti uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  file_sha256 text not null check (file_sha256 ~ '^[a-f0-9]{64}$'),
  mode text not null check (mode in ('invoice','cheque')),
  page_count integer not null check (page_count between 1 and 20),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.extraction_permits enable row level security;
revoke all on public.extraction_permits from anon, authenticated;
grant all on public.extraction_permits to service_role;
