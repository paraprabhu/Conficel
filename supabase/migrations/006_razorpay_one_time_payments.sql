-- ConfiCel one-time Razorpay payments and server-side entitlement activation.
-- Apply to the original Production Supabase project before enabling checkout.
alter table public.profiles
  add column if not exists tokens_balance integer not null default 0 check (tokens_balance >= 0),
  add column if not exists subscription_started_at timestamptz,
  add column if not exists subscription_expires_at timestamptz,
  add column if not exists last_payment_id text;

create table if not exists public.conficel_payments (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null check (plan in ('standard','scale')),
  amount_paise integer not null check (amount_paise > 0),
  currency text not null default 'INR' check (currency = 'INR'),
  status text not null default 'created' check (status in ('created','paid','failed')),
  razorpay_order_id text not null unique,
  razorpay_payment_id text unique,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists conficel_payments_user_created_idx
  on public.conficel_payments(user_id, created_at desc);

alter table public.conficel_payments enable row level security;
revoke all on public.conficel_payments from anon, authenticated, public;

create or replace function public.activate_conficel_payment(
  p_order_id text,
  p_payment_id text,
  p_user_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.conficel_payments%rowtype;
  v_tokens integer;
  v_now timestamptz := now();
  v_expiry timestamptz;
  v_balance integer;
begin
  if p_order_id is null or p_payment_id is null or p_user_id is null then
    raise exception 'Invalid payment activation request';
  end if;

  select * into v_payment
  from public.conficel_payments
  where razorpay_order_id = p_order_id and user_id = p_user_id
  for update;

  if not found then
    raise exception 'Payment order not found';
  end if;

  if v_payment.status = 'paid' then
    if v_payment.razorpay_payment_id <> p_payment_id then
      raise exception 'Order was already activated with another payment';
    end if;
    select tokens_balance into v_balance from public.profiles where id = p_user_id;
    return jsonb_build_object('success', true, 'already_activated', true,
      'plan', v_payment.plan, 'tokens_balance', coalesce(v_balance,0));
  end if;

  if v_payment.status <> 'created' then
    raise exception 'Payment order is not eligible for activation';
  end if;

  if (v_payment.plan = 'standard' and v_payment.amount_paise <> 10000)
     or (v_payment.plan = 'scale' and v_payment.amount_paise <> 50000) then
    raise exception 'Payment amount does not match plan';
  end if;

  v_tokens := case when v_payment.plan = 'standard' then 50 else 500 end;

  insert into public.profiles (id, plan, tokens_balance, subscription_started_at, subscription_expires_at, last_payment_id)
  values (p_user_id, v_payment.plan, v_tokens, v_now, v_now + interval '30 days', p_payment_id)
  on conflict (id) do update set
    plan = excluded.plan,
    tokens_balance = case
      when excluded.plan = 'scale'
       and public.profiles.subscription_expires_at >= v_now
       and public.profiles.plan in ('standard','scale')
      then public.profiles.tokens_balance + excluded.tokens_balance
      else excluded.tokens_balance
    end,
    subscription_started_at = case
      when excluded.plan = 'scale'
       and public.profiles.subscription_expires_at >= v_now
       and public.profiles.plan in ('standard','scale')
      then public.profiles.subscription_started_at
      else v_now
    end,
    subscription_expires_at = case
      when excluded.plan = 'scale'
       and public.profiles.subscription_expires_at >= v_now
       and public.profiles.plan in ('standard','scale')
      then public.profiles.subscription_expires_at + interval '30 days'
      else v_now + interval '30 days'
    end,
    last_payment_id = excluded.last_payment_id,
    updated_at = v_now;

  update public.conficel_payments
  set status = 'paid', razorpay_payment_id = p_payment_id, paid_at = v_now
  where id = v_payment.id;

  select tokens_balance into v_balance from public.profiles where id = p_user_id;
  select subscription_expires_at into v_expiry from public.profiles where id = p_user_id;

  return jsonb_build_object('success', true, 'already_activated', false,
    'plan', v_payment.plan, 'tokens_balance', coalesce(v_balance,0),
    'subscription_expires_at', v_expiry);
end;
$$;

revoke all on function public.activate_conficel_payment(text,text,uuid) from public, anon, authenticated;
grant execute on function public.activate_conficel_payment(text,text,uuid) to service_role;

create or replace function public.consume_conficel_paid_tokens(
  p_user_id uuid,
  p_page_count integer
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
begin
  if p_user_id is null or p_page_count is null or p_page_count < 1 or p_page_count > 20 then
    raise exception 'Invalid paid-token request';
  end if;
  select * into v_profile from public.profiles where id = p_user_id for update;
  if not found or v_profile.plan not in ('standard','scale')
     or v_profile.subscription_expires_at is null
     or v_profile.subscription_expires_at <= now() then
    return jsonb_build_object('allowed',false,'reason','paid_plan_inactive');
  end if;
  if v_profile.tokens_balance < p_page_count then
    return jsonb_build_object('allowed',false,'reason','paid_tokens_exhausted',
      'tokens_remaining',v_profile.tokens_balance);
  end if;
  update public.profiles
  set tokens_balance = tokens_balance - p_page_count, updated_at = now()
  where id = p_user_id;
  return jsonb_build_object('allowed',true,'tokens_consumed',p_page_count,
    'tokens_remaining',v_profile.tokens_balance-p_page_count,
    'subscription_expires_at',v_profile.subscription_expires_at);
end;
$$;
revoke all on function public.consume_conficel_paid_tokens(uuid,integer) from public, anon, authenticated;
grant execute on function public.consume_conficel_paid_tokens(uuid,integer) to service_role;
