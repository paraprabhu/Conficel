-- CONFICEL PREVIEW DATABASE BOOTSTRAP
-- Target: Supabase project ConfiCel-Preview only.
-- Apply this file ONCE in the Supabase SQL Editor for the Preview project.
-- Do NOT run against the Production Supabase project.
-- Creates profiles, free-trial controls, extraction permits and Razorpay
-- one-time payment/subscription tables and functions.
-- Existing auth users are NOT created by this script; create the Preview
-- admin/customer account separately through Supabase Authentication.



-- =====================================================================
-- SOURCE: supabase/schema.sql
-- =====================================================================

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



-- =====================================================================
-- SOURCE: supabase/migrations/002_free_trial_protection.sql
-- =====================================================================

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

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 1));
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



-- =====================================================================
-- SOURCE: supabase/migrations/003_page_based_free_tokens.sql
-- =====================================================================

-- Convert the free trial from per-file counting to per-page token counting.
-- Apply after 002_free_trial_protection.sql.
alter table public.free_trial_devices rename column documents_used to tokens_used;
alter table public.free_trial_devices drop constraint if exists free_trial_devices_documents_used_check;
alter table public.free_trial_devices add constraint free_trial_devices_tokens_used_check
  check (tokens_used between 0 and 20);

drop function if exists public.consume_conficel_free_document(uuid,text,text,text);

create or replace function public.consume_conficel_free_tokens(
  p_user_id uuid,
  p_device_hash text,
  p_ip_hash text,
  p_document_type text,
  p_page_count integer
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_device public.free_trial_devices%rowtype;
  v_user_used integer;
  v_ip_accounts integer;
begin
  if p_user_id is null or p_device_hash is null or length(p_device_hash) < 32
     or p_ip_hash is null or length(p_ip_hash) < 32
     or p_page_count is null or p_page_count < 1 or p_page_count > 20 then
    raise exception 'Invalid trial request';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 1));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_device_hash, 0));

  select * into v_device from public.free_trial_devices
  where device_hash = p_device_hash for update;

  if found and v_device.user_id <> p_user_id then
    return jsonb_build_object('allowed', false, 'reason', 'device_already_used');
  end if;

  if not found then
    insert into public.free_trial_devices(device_hash,user_id,tokens_used)
    values(p_device_hash,p_user_id,0) returning * into v_device;
  end if;

  select count(distinct user_id) into v_ip_accounts
  from public.free_trial_ip_signals where ip_hash = p_ip_hash;

  insert into public.free_trial_ip_signals(ip_hash,user_id,device_hash)
  values(p_ip_hash,p_user_id,p_device_hash)
  on conflict(ip_hash,user_id,device_hash)
  do update set last_seen_at=now(),
    request_count=public.free_trial_ip_signals.request_count+1;

  select coalesce(sum(tokens_used),0) into v_user_used
  from public.free_trial_devices where user_id=p_user_id;

  if v_user_used + p_page_count > 20 then
    return jsonb_build_object('allowed',false,'reason','trial_exhausted',
      'tokens_used',v_user_used,'tokens_remaining',greatest(0,20-v_user_used),
      'requested_tokens',p_page_count);
  end if;

  update public.free_trial_devices set tokens_used=tokens_used+p_page_count
  where device_hash=p_device_hash;

  v_user_used := v_user_used + p_page_count;
  return jsonb_build_object('allowed',true,'tokens_used',v_user_used,
    'tokens_remaining',greatest(0,20-v_user_used),'tokens_consumed',p_page_count,
    'ip_shared_signal',v_ip_accounts >= 3,
    'document_type',left(coalesce(p_document_type,'document'),30));
end;
$$;

revoke all on function public.consume_conficel_free_tokens(uuid,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.consume_conficel_free_tokens(uuid,text,text,text,integer) to service_role;



-- =====================================================================
-- SOURCE: supabase/migrations/004_extraction_permits.sql
-- =====================================================================

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



-- =====================================================================
-- SOURCE: supabase/migrations/005_extend_extraction_modes.sql
-- =====================================================================

-- Extend one-use extraction permits to the existing quotation and other-document workflows.
alter table public.extraction_permits
  drop constraint if exists extraction_permits_mode_check;
alter table public.extraction_permits
  add constraint extraction_permits_mode_check
  check (mode in ('invoice','cheque','quotation','other'));



-- =====================================================================
-- SOURCE: supabase/migrations/006_razorpay_one_time_subscriptions.sql
-- =====================================================================

-- ConfiCel one-time Razorpay subscriptions with 30-day access.
-- Apply this migration in Supabase SQL Editor after migrations 002-005
-- and the base profiles schema have been applied.

alter table public.profiles
  add column if not exists tokens_balance integer not null default 0
    check (tokens_balance >= 0),
  add column if not exists subscription_started_at timestamptz,
  add column if not exists subscription_expires_at timestamptz,
  add column if not exists last_payment_id text;

create table if not exists public.conficel_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null check (plan in ('standard','scale')),
  amount_paise integer not null check (
    (plan = 'standard' and amount_paise = 10000) or
    (plan = 'scale' and amount_paise = 50000)
  ),
  currency text not null default 'INR' check (currency = 'INR'),
  razorpay_order_id text not null unique,
  razorpay_payment_id text unique,
  status text not null default 'created'
    check (status in ('created','paid','failed')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

alter table public.conficel_payments enable row level security;
revoke all on public.conficel_payments from anon, authenticated;
grant all on public.conficel_payments to service_role;

create or replace function public.activate_conficel_payment(
  p_order_id text,
  p_payment_id text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.conficel_payments%rowtype;
  v_profile public.profiles%rowtype;
  v_now timestamptz := now();
  v_base timestamptz;
  v_allowance integer;
  v_new_balance integer;
begin
  if coalesce(p_order_id,'') = '' or coalesce(p_payment_id,'') = '' then
    raise exception 'Payment identifiers are required';
  end if;

  select * into v_payment
  from public.conficel_payments
  where razorpay_order_id = p_order_id
  for update;

  if not found then
    raise exception 'Payment order not found';
  end if;

  if v_payment.status = 'paid' then
    if v_payment.razorpay_payment_id <> p_payment_id then
      raise exception 'Order was already paid with a different payment';
    end if;
    select * into v_profile from public.profiles where id = v_payment.user_id;
    return jsonb_build_object(
      'activated', true, 'already_activated', true,
      'plan', v_profile.plan, 'tokens_balance', v_profile.tokens_balance,
      'subscription_expires_at', v_profile.subscription_expires_at
    );
  end if;

  select * into v_profile
  from public.profiles
  where id = v_payment.user_id
  for update;

  if not found then
    raise exception 'Customer profile not found';
  end if;

  v_allowance := case when v_payment.plan = 'standard' then 50 else 500 end;

  -- Scale tokens carry forward only for an on-time Scale renewal.
  if v_profile.plan = 'scale'
     and v_payment.plan = 'scale'
     and v_profile.subscription_expires_at > v_now then
    v_new_balance := v_profile.tokens_balance + v_allowance;
  else
    v_new_balance := v_allowance;
  end if;

  if v_profile.subscription_expires_at > v_now then
    v_base := v_profile.subscription_expires_at;
  else
    v_base := v_now;
  end if;

  update public.profiles
  set plan = v_payment.plan,
      tokens_balance = v_new_balance,
      subscription_started_at = case
        when subscription_expires_at > v_now then subscription_started_at
        else v_now
      end,
      subscription_expires_at = v_base + interval '30 days',
      last_payment_id = p_payment_id,
      updated_at = v_now
  where id = v_payment.user_id
  returning * into v_profile;

  update public.conficel_payments
  set status = 'paid', razorpay_payment_id = p_payment_id, paid_at = v_now
  where id = v_payment.id;

  return jsonb_build_object(
    'activated', true, 'already_activated', false,
    'plan', v_profile.plan, 'tokens_balance', v_profile.tokens_balance,
    'subscription_expires_at', v_profile.subscription_expires_at
  );
end;
$$;

revoke all on function public.activate_conficel_payment(text,text) from public, anon, authenticated;
grant execute on function public.activate_conficel_payment(text,text) to service_role;

create or replace function public.reserve_conficel_paid_tokens(
  p_user_id uuid,
  p_jti uuid,
  p_file_sha256 text,
  p_mode text,
  p_page_count integer,
  p_expires_at timestamptz
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
begin
  if p_user_id is null or p_jti is null
     or coalesce(p_file_sha256,'') !~ '^[a-f0-9]{64}$'
     or coalesce(p_mode,'') not in ('invoice','cheque','quotation','other')
     or p_page_count is null or p_page_count < 1 or p_page_count > 20
     or p_expires_at is null or p_expires_at <= now() then
    raise exception 'Invalid paid extraction reservation';
  end if;

  select * into v_profile
  from public.profiles
  where id = p_user_id
  for update;

  if not found
     or v_profile.plan not in ('standard','scale')
     or v_profile.subscription_expires_at is null
     or v_profile.subscription_expires_at <= now() then
    return jsonb_build_object('allowed',false,'reason','subscription_inactive');
  end if;

  if v_profile.tokens_balance < p_page_count then
    return jsonb_build_object('allowed',false,'reason','insufficient_tokens',
      'tokens_remaining',v_profile.tokens_balance);
  end if;

  insert into public.extraction_permits
    (jti,user_id,file_sha256,mode,page_count,expires_at)
  values
    (p_jti,p_user_id,p_file_sha256,p_mode,p_page_count,p_expires_at);

  update public.profiles
  set tokens_balance = tokens_balance - p_page_count,
      updated_at = now()
  where id = p_user_id
  returning * into v_profile;

  return jsonb_build_object(
    'allowed',true,
    'paid',true,
    'tokens_remaining',v_profile.tokens_balance,
    'tokens_consumed',p_page_count
  );
end;
$$;

revoke all on function public.reserve_conficel_paid_tokens(uuid,uuid,text,text,integer,timestamptz) from public, anon, authenticated;
grant execute on function public.reserve_conficel_paid_tokens(uuid,uuid,text,text,integer,timestamptz) to service_role;

