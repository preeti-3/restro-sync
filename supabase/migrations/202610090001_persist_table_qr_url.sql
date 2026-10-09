-- Preserve the printable QR payload so owners can view and reuse an active code.
alter table public.table_qr_codes
  add column if not exists order_url text;

alter table public.table_qr_codes
  drop constraint if exists table_qr_codes_order_url_length;

alter table public.table_qr_codes
  add constraint table_qr_codes_order_url_length
  check (order_url is null or char_length(order_url) <= 2048);

drop function if exists public.regenerate_table_qr(uuid,text);

create or replace function public.regenerate_table_qr(
  p_table_id uuid,
  p_token_hash text,
  p_order_url text
) returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  r uuid;
  q uuid;
begin
  select restaurant_id into r from restaurant_tables where id=p_table_id;
  if not has_restaurant_role(r,array['OWNER','ADMIN']::restaurant_role[]) then
    raise exception 'Forbidden';
  end if;

  update table_qr_codes
  set active=false,deactivated_at=now()
  where table_id=p_table_id and restaurant_id=r and active;

  insert into table_qr_codes(restaurant_id,table_id,token_hash,order_url,generated_by)
  values(r,p_table_id,p_token_hash,p_order_url,auth.uid())
  returning id into q;

  insert into audit_logs(restaurant_id,actor_id,action,entity_type,entity_id,new_data)
  values(r,auth.uid(),'TABLE_QR_GENERATED','restaurant_table',p_table_id,jsonb_build_object('qrCodeId',q));

  return q;
end
$$;

revoke all on function public.regenerate_table_qr(uuid,text,text) from public;
grant execute on function public.regenerate_table_qr(uuid,text,text) to authenticated;
