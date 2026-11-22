-- ConfiCel account billing and token ledger.
-- Run on the original Production Supabase project before deploying this feature.

create table if not exists public.conficel_token_ledger (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_type text not null check (entry_type in ('purchase','usage','adjustment','refund')),
  tokens_delta integer not null check (tokens_delta <> 0),
  balance_after integer not null check (balance_after >= 0),
  description text not null,
  payment_id text,
  created_at timestamptz not null default now()
);

create index if not exists conficel_token_ledger_user_created_idx
  on public.conficel_token_ledger(user_id, created_at desc);

alter table public.conficel_token_ledger enable row level security;
revoke all on public.conficel_token_ledger from anon, authenticated, public;

create or replace function public.record_conficel_token_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_delta integer;
  v_type text;
  v_description text;
begin
  if TG_OP = 'INSERT' then
    v_delta := coalesce(NEW.tokens_balance, 0);
    if v_delta <= 0 then return NEW; end if;
    v_type := 'purchase';
    v_description := 'Paid plan token credit';
  else
    v_delta := coalesce(NEW.tokens_balance, 0) - coalesce(OLD.tokens_balance, 0);
    if v_delta = 0 then return NEW; end if;
    if v_delta < 0 then
      v_type := 'usage';
      v_description := 'Document extraction token usage';
    elsif NEW.last_payment_id is distinct from OLD.last_payment_id then
      v_type := 'purchase';
      v_description := 'Paid plan token credit';
    else
      v_type := 'adjustment';
      v_description := 'Token balance adjustment';
    end if;
  end if;

  insert into public.conficel_token_ledger
    (user_id, entry_type, tokens_delta, balance_after, description, payment_id)
  values
    (NEW.id, v_type, v_delta, coalesce(NEW.tokens_balance,0), v_description, NEW.last_payment_id);
  return NEW;
end;
$$;

drop trigger if exists conficel_token_balance_audit on public.profiles;
create trigger conficel_token_balance_audit
after insert or update of tokens_balance on public.profiles
for each row execute function public.record_conficel_token_change();

-- Backfill paid purchases already present before the ledger was introduced.
insert into public.conficel_token_ledger
  (user_id, entry_type, tokens_delta, balance_after, description, payment_id, created_at)
select p.user_id, 'purchase',
       case when p.plan = 'standard' then 50 else 500 end,
       coalesce(pr.tokens_balance, case when p.plan = 'standard' then 50 else 500 end),
       'Paid plan purchase (historical backfill)',
       p.razorpay_payment_id,
       coalesce(p.paid_at, p.created_at)
from public.conficel_payments p
left join public.profiles pr on pr.id = p.user_id
where p.status = 'paid'
  and not exists (
    select 1 from public.conficel_token_ledger l
    where l.payment_id = p.razorpay_payment_id
      and l.entry_type = 'purchase'
  );

grant select on public.conficel_token_ledger to service_role;
