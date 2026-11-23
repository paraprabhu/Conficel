-- ConfiCel: make every successful paid purchase cumulative.
-- Apply on Production Supabase after migrations 006-009.

create or replace function public.activate_conficel_payment(
  p_order_id text,
  p_payment_id text,
  p_user_id uuid,
  p_currency text default 'INR',
  p_amount_minor integer default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.conficel_payments%rowtype;
  v_tokens integer;
  v_expected_amount integer;
  v_expected_currency text;
  v_now timestamptz := now();
  v_expiry timestamptz;
  v_balance integer;
  v_plan_label text;
  v_previous_expiry timestamptz;
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

  -- Idempotency: a successfully activated order can never credit tokens twice.
  if v_payment.status = 'paid' then
    if v_payment.razorpay_payment_id <> p_payment_id then
      raise exception 'Order was already activated with another payment';
    end if;
    select tokens_balance into v_balance from public.profiles where id = p_user_id;
    return jsonb_build_object('success', true, 'already_activated', true,
      'plan', case
        when v_payment.plan like '%_starter' then 'starter'
        when v_payment.plan like '%_standard' then 'standard'
        when v_payment.plan like '%_professional' then 'professional'
        when v_payment.plan like '%_business' then 'business'
        else v_payment.plan
      end,
      'tokens_balance', coalesce(v_balance,0));
  end if;

  if v_payment.status <> 'created' then
    raise exception 'Payment order is not eligible for activation';
  end if;

  v_expected_currency := case
    when v_payment.plan in ('standard','scale') then 'INR'
    when v_payment.plan like 'us_%' then 'USD'
    when v_payment.plan like 'eu_%' then 'EUR'
    when v_payment.plan like 'ae_%' then 'AED'
    else null
  end;

  v_expected_amount := case v_payment.plan
    when 'standard' then 10000
    when 'scale' then 50000
    when 'us_starter' then 399
    when 'us_standard' then 799
    when 'us_professional' then 1199
    when 'us_business' then 1500
    when 'eu_starter' then 349
    when 'eu_standard' then 749
    when 'eu_professional' then 1099
    when 'eu_business' then 1399
    when 'ae_starter' then 1500
    when 'ae_standard' then 2900
    when 'ae_professional' then 4500
    when 'ae_business' then 5500
    else null
  end;

  if v_expected_currency is null or v_expected_amount is null
     or v_payment.currency <> v_expected_currency
     or v_payment.amount_minor <> v_expected_amount
     or p_currency <> v_expected_currency
     or p_amount_minor <> v_expected_amount then
    raise exception 'Payment currency or amount does not match the selected plan';
  end if;

  v_tokens := case
    when v_payment.plan = 'standard' then 50
    when v_payment.plan = 'scale' then 500
    when v_payment.plan like '%_starter' then 100
    when v_payment.plan like '%_standard' then 500
    when v_payment.plan like '%_professional' then 1000
    when v_payment.plan like '%_business' then 2500
    else 0
  end;

  v_plan_label := case
    when v_payment.plan like '%_starter' then 'starter'
    when v_payment.plan like '%_standard' then 'standard'
    when v_payment.plan like '%_professional' then 'professional'
    when v_payment.plan like '%_business' then 'business'
    else v_payment.plan
  end;

  -- Each distinct paid order adds its tokens. If the existing paid entitlement
  -- is still active, extend its expiry by 30 days; otherwise start a fresh period.
  select subscription_expires_at into v_previous_expiry
  from public.profiles where id = p_user_id for update;

  v_expiry := case
    when v_previous_expiry is not null and v_previous_expiry > v_now
      then v_previous_expiry + interval '30 days'
    else v_now + interval '30 days'
  end;

  insert into public.profiles
    (id, plan, tokens_balance, subscription_started_at, subscription_expires_at, last_payment_id)
  values
    (p_user_id, v_plan_label, v_tokens, v_now, v_expiry, p_payment_id)
  on conflict (id) do update set
    plan = excluded.plan,
    tokens_balance = public.profiles.tokens_balance + excluded.tokens_balance,
    subscription_started_at = case
      when public.profiles.subscription_expires_at is not null
       and public.profiles.subscription_expires_at > v_now
      then public.profiles.subscription_started_at
      else v_now
    end,
    subscription_expires_at = v_expiry,
    last_payment_id = excluded.last_payment_id,
    updated_at = v_now;

  update public.conficel_payments
  set status = 'paid', razorpay_payment_id = p_payment_id, paid_at = v_now
  where id = v_payment.id;

  select tokens_balance, subscription_expires_at into v_balance, v_expiry
  from public.profiles where id = p_user_id;

  return jsonb_build_object('success', true, 'already_activated', false,
    'plan', v_plan_label, 'tokens_balance', coalesce(v_balance,0),
    'subscription_expires_at', v_expiry);
end;
$$;

revoke all on function public.activate_conficel_payment(text,text,uuid,text,integer) from public, anon, authenticated;
grant execute on function public.activate_conficel_payment(text,text,uuid,text,integer) to service_role;
