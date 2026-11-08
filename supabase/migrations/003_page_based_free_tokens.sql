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
