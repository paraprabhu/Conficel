-- ConfiCel free-trial anti-abuse and server-enforced quota.
-- Apply this file in the Supabase SQL Editor before enabling the Cloudflare endpoint.

create table if not exists public.free_trial_devices (
  device_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  documents_used integer not null default 0 check (documents_used between 0 and 20)
);

create table if not exists public.free_trial_ip_signals (
  ip_hash text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  device_hash text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  request_count integer not null default 1,
  primary key (ip_hash, user_id, device_hash)
);

alter table public.free_trial_devices enable row level security;
alter table public.free_trial_ip_signals enable row level security;
revoke all on public.free_trial_devices from anon, authenticated;
revoke all on public.free_trial_ip_signals from anon, authenticated;

create or replace function public.consume_conficel_free_document(
  p_user_id uuid,
  p_device_hash text,
  p_ip_hash text,
  p_document_type text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_device public.free_trial_devices%rowtype;
  v_used integer;
  v_user_used integer;
  v_ip_accounts integer;
begin
  if p_user_id is null or p_device_hash is null or length(p_device_hash) < 32
     or p_ip_hash is null or length(p_ip_hash) < 32 then
    raise exception 'Invalid trial request';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_device_hash, 0));

  select * into v_device
  from public.free_trial_devices
  where device_hash = p_device_hash
  for update;

  if found and v_device.user_id <> p_user_id then
    return jsonb_build_object('allowed', false, 'reason', 'device_already_used');
  end if;

  if not found then
    insert into public.free_trial_devices(device_hash, user_id, documents_used)
    values (p_device_hash, p_user_id, 0)
    returning * into v_device;
  end if;

  select count(distinct user_id) into v_ip_accounts
  from public.free_trial_ip_signals
  where ip_hash = p_ip_hash;

  insert into public.free_trial_ip_signals(ip_hash,user_id,device_hash)
  values(p_ip_hash,p_user_id,p_device_hash)
  on conflict(ip_hash,user_id,device_hash)
  do update set last_seen_at=now(),
                request_count=public.free_trial_ip_signals.request_count+1;

  select coalesce(sum(documents_used),0) into v_user_used
  from public.free_trial_devices
  where user_id = p_user_id;

  if v_user_used >= 20 then
    return jsonb_build_object('allowed', false, 'reason', 'trial_exhausted',
      'documents_used', v_user_used, 'documents_remaining', 0);
  end if;

  update public.free_trial_devices
  set documents_used = documents_used + 1
  where device_hash = p_device_hash
  returning documents_used into v_used;

  v_user_used := v_user_used + 1;
  return jsonb_build_object(
    'allowed', true,
    'documents_used', v_user_used,
    'documents_remaining', greatest(0,20-v_user_used),
    'ip_shared_signal', v_ip_accounts >= 3,
    'document_type', left(coalesce(p_document_type,'document'),30)
  );
end;
$$;

revoke all on function public.consume_conficel_free_document(uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.consume_conficel_free_document(uuid,text,text,text) to service_role;
