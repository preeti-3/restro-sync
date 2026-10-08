-- Customer table-QR ordering, guest sessions, visits, tracking, and manual UPI verification.
alter table public.restaurant_settings
  add column if not exists upi_id text,
  add column if not exists upi_payee_name text;

alter table public.orders alter column cashier_id drop not null;
alter table public.orders
  add column if not exists source text not null default 'STAFF' check (source in ('STAFF','CUSTOMER_QR')),
  add column if not exists guest_session_id uuid,
  add column if not exists table_visit_id uuid,
  add column if not exists guest_status text check (guest_status in ('PLACED','ACCEPTED','PREPARING','READY','SERVED','CANCELLED')),
  add column if not exists estimated_ready_at timestamptz,
  add column if not exists guest_submission_key uuid,
  add column if not exists guest_payment_state text not null default 'PENDING' check (guest_payment_state in ('PENDING','AWAITING_VERIFICATION','PAID','REJECTED'));

create table if not exists public.table_qr_codes (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references public.restaurant_tables(id) on delete cascade,
  token_hash text not null unique,
  active boolean not null default true,
  generated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  deactivated_at timestamptz
);
create unique index if not exists idx_one_active_qr_per_table on public.table_qr_codes(table_id) where active;

create table if not exists public.table_visits (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references public.restaurant_tables(id) on delete restrict,
  status text not null default 'OPEN' check (status in ('OPEN','CLOSED')),
  started_at timestamptz not null default now(),
  closed_at timestamptz,
  closed_by uuid references public.profiles(id) on delete set null
);
create unique index if not exists idx_one_open_visit_per_table on public.table_visits(table_id) where status='OPEN';
create index if not exists idx_visits_table_started on public.table_visits(table_id,started_at desc);

create table if not exists public.guest_sessions (
  id uuid primary key default gen_random_uuid(),
  session_hash text not null unique,
  qr_code_id uuid not null references public.table_qr_codes(id) on delete restrict,
  table_id uuid not null references public.restaurant_tables(id) on delete restrict,
  visit_id uuid not null references public.table_visits(id) on delete restrict,
  expires_at timestamptz not null default (now()+interval '12 hours'),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists idx_guest_sessions_visit on public.guest_sessions(visit_id);

do $$ begin
  alter table public.orders add constraint orders_guest_session_fk foreign key (guest_session_id) references public.guest_sessions(id) on delete restrict;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.orders add constraint orders_table_visit_fk foreign key (table_visit_id) references public.table_visits(id) on delete restrict;
exception when duplicate_object then null; end $$;
create unique index if not exists idx_guest_order_submission on public.orders(guest_session_id,guest_submission_key) where guest_submission_key is not null;
create index if not exists idx_orders_visit on public.orders(table_visit_id,created_at desc) where table_visit_id is not null;

create table if not exists public.guest_payment_claims (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  guest_session_id uuid not null references public.guest_sessions(id) on delete restrict,
  amount_paise bigint not null check (amount_paise>0),
  transaction_reference text,
  status text not null default 'AWAITING_VERIFICATION' check (status in ('AWAITING_VERIFICATION','VERIFIED','REJECTED')),
  verified_by uuid references public.profiles(id) on delete set null,
  verified_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now()
);
create unique index if not exists idx_one_awaiting_claim_per_order on public.guest_payment_claims(order_id) where status='AWAITING_VERIFICATION';
create index if not exists idx_payment_claims_status on public.guest_payment_claims(status,created_at);

alter table public.table_qr_codes enable row level security;
alter table public.table_visits enable row level security;
alter table public.guest_sessions enable row level security;
alter table public.guest_payment_claims enable row level security;

create policy qr_admin_all on public.table_qr_codes for all to authenticated using (public.has_role(array['ADMIN']::public.user_role[])) with check (public.has_role(array['ADMIN']::public.user_role[]));
create policy visits_staff_read on public.table_visits for select to authenticated using (public.has_role(array['ADMIN','CASHIER','KITCHEN']::public.user_role[]));
create policy claims_staff_read on public.guest_payment_claims for select to authenticated using (public.has_role(array['ADMIN','CASHIER']::public.user_role[]));

create or replace function public.regenerate_table_qr(p_table_id uuid,p_token_hash text)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_qr_id uuid;
begin
  if not public.has_role(array['ADMIN']::user_role[]) then raise exception 'Forbidden'; end if;
  perform 1 from restaurant_tables where id=p_table_id and active for update;
  if not found then raise exception 'Table does not exist or is inactive'; end if;
  update table_qr_codes set active=false,deactivated_at=now() where table_id=p_table_id and active;
  insert into table_qr_codes(table_id,token_hash,generated_by)
    values(p_table_id,p_token_hash,auth.uid()) returning id into v_qr_id;
  insert into audit_logs(actor_id,action,entity_type,entity_id,new_data)
    values(auth.uid(),'TABLE_QR_REGENERATED','restaurant_table',p_table_id,jsonb_build_object('qrCodeId',v_qr_id));
  return v_qr_id;
end $$;

create or replace function public.open_guest_session(p_qr_hash text,p_session_hash text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_table_id uuid; v_table_name text; v_qr_id uuid; v_visit uuid; v_session uuid; v_restaurant text;
begin
  select q.id,t.id,t.name into v_qr_id,v_table_id,v_table_name from table_qr_codes q join restaurant_tables t on t.id=q.table_id
  where q.token_hash=p_qr_hash and q.active and t.active;
  if not found then raise exception 'This table QR code is invalid or inactive'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_table_id::text,0));
  select id into v_visit from table_visits where table_id=v_table_id and status='OPEN' order by started_at desc limit 1;
  if v_visit is null then insert into table_visits(table_id) values(v_table_id) returning id into v_visit; end if;
  insert into guest_sessions(session_hash,qr_code_id,table_id,visit_id) values(p_session_hash,v_qr_id,v_table_id,v_visit) returning id into v_session;
  select restaurant_name into v_restaurant from restaurant_settings where id=1;
  return jsonb_build_object('sessionId',v_session,'visitId',v_visit,'tableId',v_table_id,'tableName',v_table_name,'restaurantName',v_restaurant);
end $$;

create or replace function public.create_guest_order(p_guest_session_id uuid,p_submission_key uuid,p_customer_name text,p_instructions text,p_items jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_session guest_sessions%rowtype; v_existing uuid; v_order uuid; v_kot uuid; v_line jsonb; v_item record; v_variant_id uuid; v_variant_name text; v_variant_delta bigint; v_order_item uuid; v_addons bigint; v_subtotal bigint:=0; v_tax int; v_service int; v_line_total bigint; v_addon_names text;
begin
  if length(trim(p_customer_name))<1 or length(trim(p_customer_name))>80 then raise exception 'Enter a name or nickname'; end if;
  if jsonb_array_length(p_items)<1 or jsonb_array_length(p_items)>50 then raise exception 'Your cart must contain between 1 and 50 items'; end if;
  select id into v_existing from orders where guest_session_id=p_guest_session_id and guest_submission_key=p_submission_key;
  if v_existing is not null then return v_existing; end if;
  select gs.* into v_session from guest_sessions gs join table_visits tv on tv.id=gs.visit_id where gs.id=p_guest_session_id and gs.expires_at>now() and tv.status='OPEN' for update of gs;
  if not found then raise exception 'Your table session has expired. Scan the QR code again'; end if;
  if (select count(*) from orders where guest_session_id=p_guest_session_id and created_at>now()-interval '1 minute')>=3 then raise exception 'Too many orders submitted. Please wait a minute'; end if;
  select tax_basis_points,service_charge_basis_points into v_tax,v_service from restaurant_settings where id=1;
  insert into orders(order_type,status,table_id,cashier_id,customer_name,instructions,source,guest_session_id,table_visit_id,guest_status,guest_submission_key)
  values('DINE_IN','CONFIRMED',v_session.table_id,null,trim(p_customer_name),nullif(trim(p_instructions),''),'CUSTOMER_QR',v_session.id,v_session.visit_id,'PLACED',p_submission_key) returning id into v_order;
  insert into kot_tickets(order_id) values(v_order) returning id into v_kot;
  for v_line in select * from jsonb_array_elements(p_items) loop
    if (v_line->>'quantity')::int not between 1 and 20 then raise exception 'Invalid quantity'; end if;
    select id,name,price_paise into strict v_item from menu_items where id=(v_line->>'menuItemId')::uuid and active and available for share;
    v_line_total:=v_item.price_paise; v_variant_id:=null; v_variant_name:=null; v_variant_delta:=0;
    if nullif(v_line->>'variantId','') is not null then
      select id,name,price_delta_paise into strict v_variant_id,v_variant_name,v_variant_delta from menu_variants where id=(v_line->>'variantId')::uuid and menu_item_id=v_item.id and active;
      v_line_total:=v_line_total+v_variant_delta;
    end if;
    select coalesce(sum(a.price_paise),0),string_agg(a.name,', ' order by a.name) into v_addons,v_addon_names
      from addons a join menu_item_addons ma on ma.addon_id=a.id
      where ma.menu_item_id=v_item.id and a.active and a.id in(select jsonb_array_elements_text(coalesce(v_line->'addonIds','[]'::jsonb))::uuid);
    v_line_total:=(v_line_total+v_addons)*(v_line->>'quantity')::int; v_subtotal:=v_subtotal+v_line_total;
    insert into order_items(order_id,menu_item_id,item_name,unit_price_paise,quantity,variant_id,variant_name,notes,line_total_paise,sent_to_kitchen)
      values(v_order,v_item.id,v_item.name,v_item.price_paise,(v_line->>'quantity')::int,v_variant_id,v_variant_name,nullif(trim(v_line->>'notes'),''),v_line_total,true) returning id into v_order_item;
    insert into order_item_addons(order_item_id,addon_id,addon_name,price_paise)
      select v_order_item,a.id,a.name,a.price_paise from addons a join menu_item_addons ma on ma.addon_id=a.id
      where ma.menu_item_id=v_item.id and a.active and a.id in(select jsonb_array_elements_text(coalesce(v_line->'addonIds','[]'::jsonb))::uuid);
    insert into kot_items(kot_id,order_item_id,item_name,quantity,variant_name,addons_text,notes)
      values(v_kot,v_order_item,v_item.name,(v_line->>'quantity')::int,v_variant_name,v_addon_names,nullif(trim(v_line->>'notes'),''));
  end loop;
  update orders set subtotal_paise=v_subtotal,tax_paise=round(v_subtotal*v_tax::numeric/10000),service_charge_paise=round(v_subtotal*v_service::numeric/10000),total_paise=v_subtotal+round(v_subtotal*v_tax::numeric/10000)+round(v_subtotal*v_service::numeric/10000) where id=v_order;
  update restaurant_tables set status='OCCUPIED' where id=v_session.table_id;
  update guest_sessions set last_seen_at=now() where id=v_session.id;
  return v_order;
end $$;

create or replace function public.accept_guest_order(p_order_id uuid) returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.has_role(array['ADMIN','CASHIER','KITCHEN']::user_role[]) then raise exception 'Forbidden'; end if;
  update orders set guest_status='ACCEPTED' where id=p_order_id and source='CUSTOMER_QR' and guest_status='PLACED' and status='CONFIRMED';
  if not found then raise exception 'Order cannot be accepted'; end if;
end $$;

create or replace function public.set_order_estimate(p_order_id uuid,p_minutes integer) returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.has_role(array['ADMIN','CASHIER','KITCHEN']::user_role[]) then raise exception 'Forbidden'; end if;
  if p_minutes<1 or p_minutes>240 then raise exception 'Estimate must be between 1 and 240 minutes'; end if;
  update orders set estimated_ready_at=now()+make_interval(mins=>p_minutes) where id=p_order_id and status not in ('COMPLETED','CANCELLED');
  if not found then raise exception 'Order is closed'; end if;
end $$;

create or replace function public.close_table_visit(p_table_id uuid) returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.has_role(array['ADMIN','CASHIER']::user_role[]) then raise exception 'Forbidden'; end if;
  update table_visits set status='CLOSED',closed_at=now(),closed_by=auth.uid() where table_id=p_table_id and status='OPEN';
  update restaurant_tables set status='AVAILABLE' where id=p_table_id;
  insert into audit_logs(actor_id,action,entity_type,entity_id,new_data) values(auth.uid(),'TABLE_VISIT_CLOSED','restaurant_table',p_table_id,jsonb_build_object('closedAt',now()));
end $$;

create or replace function public.verify_guest_payment(p_claim_id uuid,p_approved boolean,p_reason text default null) returns void language plpgsql security definer set search_path=public as $$
declare v_claim guest_payment_claims%rowtype; v_order orders%rowtype;
begin
  if not public.has_role(array['ADMIN','CASHIER']::user_role[]) then raise exception 'Forbidden'; end if;
  select * into v_claim from guest_payment_claims where id=p_claim_id and status='AWAITING_VERIFICATION' for update;
  if not found then raise exception 'Payment claim is no longer awaiting verification'; end if;
  select * into v_order from orders where id=v_claim.order_id for update;
  if p_approved then
    update guest_payment_claims set status='VERIFIED',verified_by=auth.uid(),verified_at=now() where id=p_claim_id;
    update orders set guest_payment_state='PAID',payment_status='PAID',payment_method='UPI' where id=v_claim.order_id;
    insert into payments(order_id,amount_paise,method,status,idempotency_key,received_by) values(v_claim.order_id,v_claim.amount_paise,'UPI','PAID',v_claim.id,auth.uid()) on conflict(idempotency_key) do nothing;
  else
    if length(trim(coalesce(p_reason,'')))<3 then raise exception 'A rejection reason is required'; end if;
    update guest_payment_claims set status='REJECTED',verified_by=auth.uid(),verified_at=now(),rejection_reason=trim(p_reason) where id=p_claim_id;
    update orders set guest_payment_state='REJECTED' where id=v_claim.order_id;
  end if;
end $$;

create or replace function public.submit_guest_payment_claim(p_guest_session_id uuid,p_order_id uuid,p_reference text)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_order orders%rowtype; v_claim uuid;
begin
  select * into v_order from orders where id=p_order_id and guest_session_id=p_guest_session_id for update;
  if not found then raise exception 'Order does not belong to this guest session'; end if;
  if v_order.guest_payment_state='PAID' then raise exception 'This bill is already marked paid'; end if;
  select id into v_claim from guest_payment_claims where order_id=p_order_id and status='AWAITING_VERIFICATION';
  if v_claim is not null then return v_claim; end if;
  insert into guest_payment_claims(order_id,guest_session_id,amount_paise,transaction_reference)
    values(p_order_id,p_guest_session_id,v_order.total_paise,nullif(trim(p_reference),'')) returning id into v_claim;
  update orders set guest_payment_state='AWAITING_VERIFICATION' where id=p_order_id;
  return v_claim;
end $$;

-- Keep customer-facing state separate from operational and payment states.
create or replace function public.update_kot_status(p_kot_id uuid,p_status kot_status) returns void language plpgsql security definer set search_path=public as $$
declare v_order uuid;
begin
  if not public.has_role(array['ADMIN','KITCHEN']::user_role[]) then raise exception 'Forbidden'; end if;
  update kot_tickets set status=p_status where id=p_kot_id and ((status='NEW' and p_status='PREPARING') or (status='PREPARING' and p_status='READY')) returning order_id into v_order;
  if not found then raise exception 'Invalid KOT transition'; end if;
  if p_status='PREPARING' then update orders set status='PREPARING',guest_status=case when source='CUSTOMER_QR' then 'PREPARING' else guest_status end where id=v_order and status='CONFIRMED';
  elsif not exists(select 1 from kot_tickets where order_id=v_order and status<>'READY') then update orders set status='READY',guest_status=case when source='CUSTOMER_QR' then 'READY' else guest_status end where id=v_order; end if;
end $$;

create or replace function public.generate_order_bill(p_order_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare v_table uuid;
begin
  if not public.has_role(array['ADMIN','CASHIER']::user_role[]) then raise exception 'Forbidden'; end if;
  update orders set status='SERVED',guest_status=case when source='CUSTOMER_QR' then 'SERVED' else guest_status end where id=p_order_id and status='READY' returning table_id into v_table;
  if not found then raise exception 'Only ready orders can be billed'; end if;
  if v_table is not null then update restaurant_tables set status='BILLING' where id=v_table; end if;
end $$;

create or replace function public.cancel_order(p_order_id uuid,p_reason text) returns void language plpgsql security definer set search_path=public as $$
declare v_order orders%rowtype;
begin
  if not public.has_role(array['ADMIN','CASHIER']::user_role[]) or length(trim(p_reason))<3 then raise exception 'A valid cancellation reason is required'; end if;
  select * into v_order from orders where id=p_order_id for update;
  if v_order.status in ('COMPLETED','CANCELLED') then raise exception 'Closed orders cannot be cancelled'; end if;
  update orders set status='CANCELLED',guest_status=case when source='CUSTOMER_QR' then 'CANCELLED' else guest_status end,cancellation_reason=trim(p_reason),cancelled_by=auth.uid(),cancelled_at=now() where id=p_order_id;
  if v_order.table_id is not null and not exists(select 1 from orders where table_id=v_order.table_id and id<>p_order_id and status not in ('COMPLETED','CANCELLED')) then update restaurant_tables set status='AVAILABLE' where id=v_order.table_id; end if;
  insert into audit_logs(actor_id,action,entity_type,entity_id,old_data,new_data) values(auth.uid(),'ORDER_CANCELLED','order',p_order_id,jsonb_build_object('status',v_order.status),jsonb_build_object('status','CANCELLED','reason',trim(p_reason)));
end $$;

revoke all on function public.open_guest_session(text,text) from public;
revoke all on function public.create_guest_order(uuid,uuid,text,text,jsonb) from public;
revoke all on function public.submit_guest_payment_claim(uuid,uuid,text) from public;
grant execute on function public.open_guest_session(text,text),public.create_guest_order(uuid,uuid,text,text,jsonb),public.submit_guest_payment_claim(uuid,uuid,text) to service_role;
grant execute on function public.regenerate_table_qr(uuid,text),public.accept_guest_order(uuid),public.set_order_estimate(uuid,integer),public.close_table_visit(uuid),public.verify_guest_payment(uuid,boolean,text) to authenticated;

do $$ begin alter publication supabase_realtime add table public.guest_payment_claims; exception when duplicate_object then null; end $$;
