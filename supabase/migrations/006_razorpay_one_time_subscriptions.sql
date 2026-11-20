-- ConfiCel one-time Razorpay subscriptions with 30-day access.
-- Apply this migration in Supabase SQL Editor before enabling payment endpoints.

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

-- A payment can activate entitlements only once. Repeated webhook/verification
-- notifications for the same captured payment are harmless.
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

  -- Early renewal extends the current term. Scale tokens carry forward only
  -- when the customer renews the same Scale plan before its current expiry.
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

-- Atomically reserve paid tokens and create the one-use extraction permit.
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
     or coalesce(p_file_sha256,'') !~ '^[a-f0-9]{64}
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
