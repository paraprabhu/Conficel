-- ConfiCel international one-time checkout (Production Supabase).
-- Apply after migrations 006 and 007. Existing INR payment rows remain valid.

alter table public.conficel_payments
  drop constraint if exists conficel_payments_plan_check,
  drop constraint if exists conficel_payments_currency_check;

alter table public.conficel_payments
  add constraint conficel_payments_plan_check
    check (plan in ('standard','scale','us_starter','us_standard','us_professional','us_business',
                    'eu_starter','eu_standard','eu_professional','eu_business',
                    'ae_starter','ae_standard','ae_professional','ae_business')),
  add constraint conficel_payments_currency_check
    check (currency in ('INR','USD','EUR','AED'));

alter table public.conficel_payments
  add column if not exists amount_minor integer;

update public.conficel_payments
set amount_minor = amount_paise
where amount_minor is null;

alter table public.conficel_payments
  alter column amount_minor set not null;

drop function if exists public.activate_conficel_payment(text,text,uuid);

create function public.activate_conficel_payment(
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

  insert into public.profiles (id, plan, tokens_balance, subscription_started_at, subscription_expires_at, last_payment_id)
  values (p_user_id, v_plan_label, v_tokens, v_now, v_now + interval '30 days', p_payment_id)
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

  select tokens_balance, subscription_expires_at into v_balance, v_expiry
  from public.profiles where id = p_user_id;

  return jsonb_build_object('success', true, 'already_activated', false,
    'plan', v_plan_label, 'tokens_balance', coalesce(v_balance,0),
    'subscription_expires_at', v_expiry);
end;
$$;

revoke all on function public.activate_conficel_payment(text,text,uuid) from public, anon, authenticated;
revoke all on function public.activate_conficel_payment(text,text,uuid,text,integer) from public, anon, authenticated;
grant execute on function public.activate_conficel_payment(text,text,uuid,text,integer) to service_role;


-- International paid tiers must be eligible for the same paid-first token consumption.
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
  if not found or v_profile.plan not in ('standard','scale','starter','professional','business')
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
