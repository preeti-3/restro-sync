-- Multi-restaurant upgrade. This migration preserves all existing rows.
-- Existing populated installations MUST configure the intended legacy owner first
-- in public.restrosync_migration_config (see README). Hosted Supabase does not
-- permit arbitrary ALTER DATABASE parameters. Empty/new installations need no row.

create type public.restaurant_status as enum ('PENDING','ACTIVE','SUSPENDED');
create type public.restaurant_role as enum ('OWNER','ADMIN','CASHIER','KITCHEN');
create type public.invitation_status as enum ('PENDING','ACCEPTED','REVOKED','EXPIRED');

create table if not exists public.restrosync_migration_config (
  key text primary key,
  value text not null,
  created_at timestamptz not null default now()
);
revoke all on public.restrosync_migration_config from public,anon,authenticated;

create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null check(length(trim(name)) between 2 and 120),
  address text not null default '', phone text not null default '', email text not null default '',
  status public.restaurant_status not null default 'PENDING',
  created_at timestamptz not null default now(), approved_at timestamptz, suspended_at timestamptz,
  updated_at timestamptz not null default now()
);
create table public.restaurant_members (
  id uuid primary key default gen_random_uuid(), restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, role public.restaurant_role not null,
  active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(restaurant_id,user_id)
);
create table public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade, active boolean not null default true,
  provisioned_by uuid references auth.users(id), created_at timestamptz not null default now()
);
create table public.staff_invitations (
  id uuid primary key default gen_random_uuid(), restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  email text not null, role public.restaurant_role not null check(role <> 'OWNER'), token_hash text not null unique,
  invited_by uuid not null references auth.users(id), expires_at timestamptz not null,
  status public.invitation_status not null default 'PENDING', accepted_by uuid references auth.users(id), accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create index restaurant_members_user_active_idx on public.restaurant_members(user_id,active,restaurant_id);
alter table public.restaurant_members add constraint restaurant_members_profile_fk foreign key(user_id) references public.profiles(id) on delete cascade;
create index restaurants_status_created_idx on public.restaurants(status,created_at desc);
create index staff_invitations_restaurant_idx on public.staff_invitations(restaurant_id,status,expires_at);

-- Resolve the one existing tenant without guessing between multiple administrators.
do $$
declare v_owner uuid; v_email text; v_has_data boolean; v_restaurant uuid;
begin
  select nullif(trim(value),'') into v_email from public.restrosync_migration_config where key='legacy_owner_email';
  select exists(select 1 from categories union all select 1 from orders union all select 1 from restaurant_tables union all select 1 from profiles union all select 1 from restaurant_settings where restaurant_name<>'RestroSync Kitchen' or address<>'' or phone<>'' or gstin<>'') into v_has_data;
  if v_has_data then
    if v_email is null then raise exception 'Legacy data exists. Insert legacy_owner_email into public.restrosync_migration_config before applying this migration.'; end if;
    select id into v_owner from auth.users where lower(email)=lower(v_email);
    if v_owner is null then raise exception 'Configured legacy owner email does not match an auth user'; end if;
    -- The explicitly configured Auth user is authoritative for this one-time
    -- ownership assignment. Older installations may not have created a profile.
    insert into profiles(id,full_name,role,active)
      select id,
        case
          when length(trim(coalesce(raw_user_meta_data->>'full_name',''))) >= 2
            then trim(raw_user_meta_data->>'full_name')
          when length(split_part(email,'@',1)) >= 2
            then split_part(email,'@',1)
          else 'Restaurant Owner'
        end,
        'ADMIN'::user_role,
        true
      from auth.users where id=v_owner
      on conflict(id) do update set role='ADMIN'::user_role,active=true;
    insert into restaurants(name,address,phone,email,status,approved_at)
      select restaurant_name,address,phone,v_email,'ACTIVE',now() from restaurant_settings order by id limit 1 returning id into v_restaurant;
    insert into restaurant_members(restaurant_id,user_id,role)
      select v_restaurant,p.id,case when p.id=v_owner then 'OWNER'::restaurant_role when p.role='ADMIN' then 'ADMIN'::restaurant_role else p.role::text::restaurant_role end
      from profiles p where p.active;
  else
    -- The initial schema creates one untouched placeholder settings row. It is not tenant data;
    -- real settings are created atomically with the first restaurant registration.
    delete from restaurant_settings where restaurant_name='RestroSync Kitchen' and address='' and phone='' and gstin='';
  end if;
end $$;

-- The explicit one-time value is no longer needed after a successful assignment.
drop table public.restrosync_migration_config;

-- Tenant key on every restaurant-owned row, populated from the default restaurant/parent chain.
alter table public.restaurant_settings add column restaurant_id uuid references public.restaurants(id);
alter table public.categories add column restaurant_id uuid references public.restaurants(id);
alter table public.menu_items add column restaurant_id uuid references public.restaurants(id);
alter table public.menu_variants add column restaurant_id uuid references public.restaurants(id);
alter table public.addons add column restaurant_id uuid references public.restaurants(id);
alter table public.menu_item_addons add column restaurant_id uuid references public.restaurants(id);
alter table public.restaurant_tables add column restaurant_id uuid references public.restaurants(id);
alter table public.orders add column restaurant_id uuid references public.restaurants(id);
alter table public.order_items add column restaurant_id uuid references public.restaurants(id);
alter table public.order_item_addons add column restaurant_id uuid references public.restaurants(id);
alter table public.kot_tickets add column restaurant_id uuid references public.restaurants(id);
alter table public.kot_items add column restaurant_id uuid references public.restaurants(id);
alter table public.payments add column restaurant_id uuid references public.restaurants(id);
alter table public.audit_logs add column restaurant_id uuid references public.restaurants(id);
alter table public.table_qr_codes add column restaurant_id uuid references public.restaurants(id);
alter table public.table_visits add column restaurant_id uuid references public.restaurants(id);
alter table public.guest_sessions add column restaurant_id uuid references public.restaurants(id);
alter table public.guest_payment_claims add column restaurant_id uuid references public.restaurants(id);

update restaurant_settings set restaurant_id=(select id from restaurants order by created_at limit 1) where restaurant_id is null;
update categories set restaurant_id=(select id from restaurants order by created_at limit 1) where restaurant_id is null;
update menu_items m set restaurant_id=c.restaurant_id from categories c where m.category_id=c.id and m.restaurant_id is null;
update menu_variants v set restaurant_id=m.restaurant_id from menu_items m where v.menu_item_id=m.id and v.restaurant_id is null;
update addons set restaurant_id=(select id from restaurants order by created_at limit 1) where restaurant_id is null;
update menu_item_addons l set restaurant_id=m.restaurant_id from menu_items m where l.menu_item_id=m.id and l.restaurant_id is null;
update restaurant_tables set restaurant_id=(select id from restaurants order by created_at limit 1) where restaurant_id is null;
update orders o set restaurant_id=coalesce(t.restaurant_id,(select id from restaurants order by created_at limit 1)) from restaurant_tables t where o.table_id=t.id and o.restaurant_id is null;
update orders set restaurant_id=(select id from restaurants order by created_at limit 1) where restaurant_id is null;
update order_items x set restaurant_id=o.restaurant_id from orders o where x.order_id=o.id and x.restaurant_id is null;
update order_item_addons x set restaurant_id=i.restaurant_id from order_items i where x.order_item_id=i.id and x.restaurant_id is null;
update kot_tickets x set restaurant_id=o.restaurant_id from orders o where x.order_id=o.id and x.restaurant_id is null;
update kot_items x set restaurant_id=k.restaurant_id from kot_tickets k where x.kot_id=k.id and x.restaurant_id is null;
update payments x set restaurant_id=o.restaurant_id from orders o where x.order_id=o.id and x.restaurant_id is null;
update audit_logs set restaurant_id=(select id from restaurants order by created_at limit 1) where restaurant_id is null;
update table_qr_codes x set restaurant_id=t.restaurant_id from restaurant_tables t where x.table_id=t.id and x.restaurant_id is null;
update table_visits x set restaurant_id=t.restaurant_id from restaurant_tables t where x.table_id=t.id and x.restaurant_id is null;
update guest_sessions x set restaurant_id=t.restaurant_id from restaurant_tables t where x.table_id=t.id and x.restaurant_id is null;
update guest_payment_claims x set restaurant_id=o.restaurant_id from orders o where x.order_id=o.id and x.restaurant_id is null;

do $$ declare t text; begin foreach t in array array['restaurant_settings','categories','menu_items','menu_variants','addons','menu_item_addons','restaurant_tables','orders','order_items','order_item_addons','kot_tickets','kot_items','payments','audit_logs','table_qr_codes','table_visits','guest_sessions','guest_payment_claims'] loop execute format('alter table public.%I alter column restaurant_id set not null',t); end loop; end $$;

-- Settings formerly used a singleton key. Keep the legacy column for compatibility but key by tenant.
alter table public.restaurant_settings drop constraint restaurant_settings_pkey;
alter table public.restaurant_settings drop constraint if exists restaurant_settings_id_check;
alter table public.restaurant_settings add primary key(restaurant_id);
alter table public.categories drop constraint categories_name_key;
alter table public.categories add constraint categories_restaurant_name_key unique(restaurant_id,name);
alter table public.addons drop constraint addons_name_key;
alter table public.addons add constraint addons_restaurant_name_key unique(restaurant_id,name);
alter table public.restaurant_tables drop constraint restaurant_tables_name_key;
alter table public.restaurant_tables add constraint restaurant_tables_restaurant_name_key unique(restaurant_id,name);

-- Composite keys make cross-restaurant references structurally impossible.
alter table categories add unique(id,restaurant_id); alter table menu_items add unique(id,restaurant_id); alter table menu_variants add unique(id,restaurant_id);
alter table addons add unique(id,restaurant_id); alter table restaurant_tables add unique(id,restaurant_id); alter table orders add unique(id,restaurant_id);
alter table order_items add unique(id,restaurant_id); alter table kot_tickets add unique(id,restaurant_id); alter table table_qr_codes add unique(id,restaurant_id);
alter table table_visits add unique(id,restaurant_id); alter table guest_sessions add unique(id,restaurant_id);
alter table menu_items add constraint menu_items_category_tenant_fk foreign key(category_id,restaurant_id) references categories(id,restaurant_id);
alter table menu_variants add constraint menu_variants_item_tenant_fk foreign key(menu_item_id,restaurant_id) references menu_items(id,restaurant_id);
alter table menu_item_addons add constraint menu_item_addons_item_tenant_fk foreign key(menu_item_id,restaurant_id) references menu_items(id,restaurant_id);
alter table menu_item_addons add constraint menu_item_addons_addon_tenant_fk foreign key(addon_id,restaurant_id) references addons(id,restaurant_id);
alter table orders add constraint orders_table_tenant_fk foreign key(table_id,restaurant_id) references restaurant_tables(id,restaurant_id);
alter table order_items add constraint order_items_order_tenant_fk foreign key(order_id,restaurant_id) references orders(id,restaurant_id);
alter table order_items add constraint order_items_menu_tenant_fk foreign key(menu_item_id,restaurant_id) references menu_items(id,restaurant_id);
alter table order_items add constraint order_items_variant_tenant_fk foreign key(variant_id,restaurant_id) references menu_variants(id,restaurant_id);
alter table order_item_addons add constraint order_item_addons_item_tenant_fk foreign key(order_item_id,restaurant_id) references order_items(id,restaurant_id);
alter table order_item_addons add constraint order_item_addons_addon_tenant_fk foreign key(addon_id,restaurant_id) references addons(id,restaurant_id);
alter table kot_tickets add constraint kot_order_tenant_fk foreign key(order_id,restaurant_id) references orders(id,restaurant_id);
alter table kot_items add constraint kot_items_kot_tenant_fk foreign key(kot_id,restaurant_id) references kot_tickets(id,restaurant_id);
alter table kot_items add constraint kot_items_order_item_tenant_fk foreign key(order_item_id,restaurant_id) references order_items(id,restaurant_id);
alter table payments add constraint payments_order_tenant_fk foreign key(order_id,restaurant_id) references orders(id,restaurant_id);
alter table table_qr_codes add constraint qr_table_tenant_fk foreign key(table_id,restaurant_id) references restaurant_tables(id,restaurant_id);
alter table table_visits add constraint visit_table_tenant_fk foreign key(table_id,restaurant_id) references restaurant_tables(id,restaurant_id);
alter table guest_sessions add constraint session_table_tenant_fk foreign key(table_id,restaurant_id) references restaurant_tables(id,restaurant_id);
alter table guest_sessions add constraint session_visit_tenant_fk foreign key(visit_id,restaurant_id) references table_visits(id,restaurant_id);
alter table guest_sessions add constraint session_qr_tenant_fk foreign key(qr_code_id,restaurant_id) references table_qr_codes(id,restaurant_id);
alter table guest_payment_claims add constraint claims_order_tenant_fk foreign key(order_id,restaurant_id) references orders(id,restaurant_id);
alter table guest_payment_claims add constraint claims_session_tenant_fk foreign key(guest_session_id,restaurant_id) references guest_sessions(id,restaurant_id);
create index orders_restaurant_created_idx on orders(restaurant_id,created_at desc);
create index orders_restaurant_status_idx on orders(restaurant_id,status,created_at desc);
create index menu_items_restaurant_category_idx on menu_items(restaurant_id,category_id) where active;
create index qr_restaurant_hash_idx on table_qr_codes(restaurant_id,token_hash) where active;

create or replace function public.is_platform_admin() returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from platform_admins where user_id=auth.uid() and active)$$;
create or replace function public.is_restaurant_member(p_restaurant uuid) returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from restaurant_members m join restaurants r on r.id=m.restaurant_id where m.user_id=auth.uid() and m.restaurant_id=p_restaurant and m.active and r.status='ACTIVE')$$;
create or replace function public.has_restaurant_role(p_restaurant uuid,p_roles restaurant_role[]) returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from restaurant_members m join restaurants r on r.id=m.restaurant_id where m.user_id=auth.uid() and m.restaurant_id=p_restaurant and m.active and m.role=any(p_roles) and r.status='ACTIVE')$$;
revoke all on function is_platform_admin(),is_restaurant_member(uuid),has_restaurant_role(uuid,restaurant_role[]) from public;
grant execute on function is_platform_admin(),is_restaurant_member(uuid),has_restaurant_role(uuid,restaurant_role[]) to authenticated;

alter table restaurants enable row level security; alter table restaurant_members enable row level security; alter table platform_admins enable row level security; alter table staff_invitations enable row level security;
drop policy if exists profiles_self_or_admin_read on profiles;
drop policy if exists profiles_admin_update on profiles;
create policy profiles_tenant_read on profiles for select to authenticated using(id=auth.uid() or is_platform_admin() or exists(select 1 from restaurant_members mine join restaurant_members theirs on theirs.restaurant_id=mine.restaurant_id where mine.user_id=auth.uid() and mine.active and theirs.user_id=profiles.id and theirs.active));
create policy restaurants_visible on restaurants for select to authenticated using(is_platform_admin() or exists(select 1 from restaurant_members m where m.restaurant_id=id and m.user_id=auth.uid() and m.active));
create policy restaurants_platform_write on restaurants for update to authenticated using(is_platform_admin()) with check(is_platform_admin());
create policy memberships_visible on restaurant_members for select to authenticated using(user_id=auth.uid() or is_platform_admin() or has_restaurant_role(restaurant_id,array['OWNER']::restaurant_role[]));
create policy memberships_owner_update on restaurant_members for update to authenticated using(has_restaurant_role(restaurant_id,array['OWNER']::restaurant_role[]) and role<>'OWNER') with check(has_restaurant_role(restaurant_id,array['OWNER']::restaurant_role[]) and role<>'OWNER');
create policy platform_admin_self_read on platform_admins for select to authenticated using(user_id=auth.uid() or is_platform_admin());
create policy invitations_owner on staff_invitations for select to authenticated using(has_restaurant_role(restaurant_id,array['OWNER']::restaurant_role[]));

-- Replace legacy policies with tenant-aware policies. Realtime observes these SELECT policies.
do $$ declare t text; p record; begin
  foreach t in array array['restaurant_settings','categories','menu_items','menu_variants','addons','menu_item_addons','restaurant_tables','orders','order_items','order_item_addons','kot_tickets','kot_items','payments','audit_logs','table_qr_codes','table_visits','guest_sessions','guest_payment_claims'] loop
    for p in select policyname from pg_policies where schemaname='public' and tablename=t loop execute format('drop policy if exists %I on public.%I',p.policyname,t); end loop;
    execute format('create policy tenant_read on public.%I for select to authenticated using(public.is_restaurant_member(restaurant_id))',t);
  end loop;
end $$;
create policy tenant_admin_settings on restaurant_settings for all to authenticated using(has_restaurant_role(restaurant_id,array['OWNER','ADMIN']::restaurant_role[])) with check(has_restaurant_role(restaurant_id,array['OWNER','ADMIN']::restaurant_role[]));
create policy tenant_admin_categories on categories for all to authenticated using(has_restaurant_role(restaurant_id,array['OWNER','ADMIN']::restaurant_role[])) with check(has_restaurant_role(restaurant_id,array['OWNER','ADMIN']::restaurant_role[]));
create policy tenant_admin_items on menu_items for all to authenticated using(has_restaurant_role(restaurant_id,array['OWNER','ADMIN']::restaurant_role[])) with check(has_restaurant_role(restaurant_id,array['OWNER','ADMIN']::restaurant_role[]));
create policy tenant_admin_tables on restaurant_tables for all to authenticated using(has_restaurant_role(restaurant_id,array['OWNER','ADMIN']::restaurant_role[])) with check(has_restaurant_role(restaurant_id,array['OWNER','ADMIN']::restaurant_role[]));
create policy tenant_admin_qr on table_qr_codes for update to authenticated using(has_restaurant_role(restaurant_id,array['OWNER','ADMIN']::restaurant_role[])) with check(has_restaurant_role(restaurant_id,array['OWNER','ADMIN']::restaurant_role[]));

-- Atomic owner registration. Public metadata cannot provision a platform administrator.
create or replace function public.handle_restaurant_registration() returns trigger language plpgsql security definer set search_path=public as $$
declare v_restaurant uuid; v_name text; v_owner text; v_address text; v_phone text;
begin
  if new.raw_user_meta_data->>'registration_type' <> 'restaurant_owner' then return new; end if;
  v_name=trim(new.raw_user_meta_data->>'restaurant_name'); v_owner=trim(new.raw_user_meta_data->>'owner_name');
  v_address=trim(new.raw_user_meta_data->>'restaurant_address'); v_phone=trim(new.raw_user_meta_data->>'restaurant_phone');
  if length(v_name)<2 or length(v_owner)<2 or length(v_address)<5 or length(v_phone)<8 then raise exception 'Invalid restaurant registration metadata'; end if;
  insert into profiles(id,full_name,role,active) values(new.id,v_owner,'ADMIN',true) on conflict(id) do update set full_name=excluded.full_name,active=true;
  insert into restaurants(name,address,phone,email,status) values(v_name,v_address,v_phone,lower(new.email),'PENDING') returning id into v_restaurant;
  insert into restaurant_members(restaurant_id,user_id,role) values(v_restaurant,new.id,'OWNER');
  insert into restaurant_settings(restaurant_id,restaurant_name,address,phone) values(v_restaurant,v_name,v_address,v_phone);
  return new;
end $$;
create trigger on_auth_user_restaurant_registration after insert on auth.users for each row execute function public.handle_restaurant_registration();

create or replace function public.accept_staff_invitation(p_token_hash text) returns void language plpgsql security definer set search_path=public as $$
declare v staff_invitations%rowtype; v_email text;
begin
  select lower(email) into v_email from auth.users where id=auth.uid();
  select * into v from staff_invitations where token_hash=p_token_hash and status='PENDING' and expires_at>now() for update;
  if not found or lower(v.email)<>v_email then raise exception 'Invitation is invalid, expired, or intended for another account'; end if;
  insert into profiles(id,full_name,role,active) select auth.uid(),coalesce(raw_user_meta_data->>'full_name',split_part(email,'@',1)),v.role::text::user_role,true from auth.users where id=auth.uid() on conflict(id) do update set active=true;
  insert into restaurant_members(restaurant_id,user_id,role) values(v.restaurant_id,auth.uid(),v.role) on conflict(restaurant_id,user_id) do update set role=excluded.role,active=true;
  update staff_invitations set status='ACCEPTED',accepted_by=auth.uid(),accepted_at=now() where id=v.id;
end $$;
grant execute on function accept_staff_invitation(text) to authenticated;

create or replace function public.platform_set_restaurant_status(p_restaurant_id uuid,p_status restaurant_status) returns void language plpgsql security definer set search_path=public as $$
begin if not is_platform_admin() then raise exception 'Forbidden'; end if;
if p_status not in ('ACTIVE','SUSPENDED') then raise exception 'Invalid status'; end if;
update restaurants set status=p_status,approved_at=case when p_status='ACTIVE' then coalesce(approved_at,now()) else approved_at end,suspended_at=case when p_status='SUSPENDED' then now() else null end,updated_at=now() where id=p_restaurant_id;
insert into audit_logs(restaurant_id,actor_id,action,entity_type,entity_id,new_data) values(p_restaurant_id,auth.uid(),'RESTAURANT_STATUS_CHANGED','restaurant',p_restaurant_id,jsonb_build_object('status',p_status)); end $$;
grant execute on function platform_set_restaurant_status(uuid,restaurant_status) to authenticated;

create or replace view public.platform_restaurant_overview with (security_invoker=true) as
select r.*,owner.full_name owner_name,r.email owner_email,(select count(*) from orders o where o.restaurant_id=r.id) order_count
from restaurants r left join lateral(select p.full_name from restaurant_members m join profiles p on p.id=m.user_id where m.restaurant_id=r.id and m.role='OWNER' limit 1) owner on true;
grant select on platform_restaurant_overview to authenticated;
create or replace function public.platform_metrics() returns table(total_restaurants bigint,pending_restaurants bigint,active_restaurants bigint,orders_30d bigint) language sql stable security definer set search_path=public as $$select count(*),count(*)filter(where status='PENDING'),count(*)filter(where status='ACTIVE'),(select count(*) from orders where created_at>now()-interval '30 days') from restaurants where is_platform_admin()$$;
grant execute on function platform_metrics() to authenticated;

-- Secure tenant-scoped reporting. Caller supplies scope; membership authorizes it.
create or replace function public.dashboard_metrics(p_restaurant_id uuid) returns table(total_sales_paise bigint,total_orders bigint,completed_orders bigint,cancelled_orders bigint,cash_paise bigint,upi_paise bigint,card_paise bigint) language sql stable security definer set search_path=public as $$select coalesce(sum(total_paise)filter(where status='COMPLETED'),0)::bigint,count(*)::bigint,count(*)filter(where status='COMPLETED')::bigint,count(*)filter(where status='CANCELLED')::bigint,coalesce(sum(total_paise)filter(where status='COMPLETED'and payment_method='CASH'),0)::bigint,coalesce(sum(total_paise)filter(where status='COMPLETED'and payment_method='UPI'),0)::bigint,coalesce(sum(total_paise)filter(where status='COMPLETED'and payment_method='CARD'),0)::bigint from orders where restaurant_id=p_restaurant_id and created_at>=current_date and has_restaurant_role(p_restaurant_id,array['OWNER','ADMIN']::restaurant_role[])$$;
create or replace function public.sales_last_seven_days(p_restaurant_id uuid) returns table(day text,sales_paise bigint) language sql stable security definer set search_path=public as $$select to_char(d,'Dy'),coalesce(sum(o.total_paise),0)::bigint from generate_series(current_date-6,current_date,'1 day')d left join orders o on o.restaurant_id=p_restaurant_id and o.created_at>=d and o.created_at<d+'1 day'::interval and o.status='COMPLETED' where has_restaurant_role(p_restaurant_id,array['OWNER','ADMIN']::restaurant_role[]) group by d order by d$$;
create or replace function public.top_selling_items(p_restaurant_id uuid,p_limit int default 5) returns table(item_name text,quantity bigint,sales_paise bigint) language sql stable security definer set search_path=public as $$select oi.item_name,sum(oi.quantity)::bigint,sum(oi.line_total_paise)::bigint from order_items oi join orders o on o.id=oi.order_id and o.restaurant_id=oi.restaurant_id where o.restaurant_id=p_restaurant_id and o.status='COMPLETED' and has_restaurant_role(p_restaurant_id,array['OWNER','ADMIN']::restaurant_role[]) group by oi.item_name order by 2 desc limit p_limit$$;
revoke all on function dashboard_metrics(),sales_last_seven_days(),top_selling_items(int),item_sales_report(),payment_method_report(),sales_report(text) from public,authenticated;
grant execute on function dashboard_metrics(uuid),sales_last_seven_days(uuid),top_selling_items(uuid,int) to authenticated;
create or replace function public.item_sales_report(p_restaurant_id uuid)returns table(item_name text,quantity bigint,sales_paise bigint)language sql stable security definer set search_path=public as $$select oi.item_name,sum(oi.quantity)::bigint,sum(oi.line_total_paise)::bigint from order_items oi join orders o on o.id=oi.order_id and o.restaurant_id=oi.restaurant_id where o.restaurant_id=p_restaurant_id and o.status='COMPLETED'and has_restaurant_role(p_restaurant_id,array['OWNER','ADMIN']::restaurant_role[])group by oi.item_name order by 2 desc$$;
create or replace function public.payment_method_report(p_restaurant_id uuid)returns table(payment_method text,transactions bigint,total_paise bigint)language sql stable security definer set search_path=public as $$select method::text,count(*)::bigint,sum(amount_paise)::bigint from payments where restaurant_id=p_restaurant_id and status='PAID'and has_restaurant_role(p_restaurant_id,array['OWNER','ADMIN']::restaurant_role[])group by method$$;
create or replace function public.sales_report(p_restaurant_id uuid,p_period text default'daily')returns table(period text,orders bigint,sales_paise bigint)language sql stable security definer set search_path=public as $$select case when p_period='monthly'then to_char(created_at,'YYYY-MM')when p_period='weekly'then to_char(date_trunc('week',created_at),'YYYY-MM-DD')else to_char(created_at,'YYYY-MM-DD')end,count(*)::bigint,sum(total_paise)::bigint from orders where restaurant_id=p_restaurant_id and status='COMPLETED'and has_restaurant_role(p_restaurant_id,array['OWNER','ADMIN']::restaurant_role[])group by 1 order by 1 desc$$;
grant execute on function item_sales_report(uuid),payment_method_report(uuid),sales_report(uuid,text)to authenticated;

-- Old unscoped mutation entry points are no longer callable. New RPC implementations must derive/check tenant.
create or replace function public.create_order_with_kot(p_payload jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare r uuid:=(p_payload->>'restaurantId')::uuid; o uuid; k uuid; line jsonb; item record; variant uuid; variant_name text; delta bigint; oi uuid; addon_total bigint; subtotal bigint:=0; discount bigint:=0; tax int; service int; line_total bigint; addon_names text;
begin
 if not has_restaurant_role(r,array['OWNER','ADMIN','CASHIER']::restaurant_role[]) then raise exception 'Forbidden'; end if;
 if jsonb_array_length(p_payload->'items')=0 then raise exception 'At least one item is required'; end if;
 if p_payload->>'orderType'='DINE_IN' then perform 1 from restaurant_tables where id=(p_payload->>'tableId')::uuid and restaurant_id=r and active and status='AVAILABLE' for update; if not found then raise exception 'Table is unavailable'; end if; end if;
 select tax_basis_points,service_charge_basis_points into tax,service from restaurant_settings where restaurant_id=r;
 insert into orders(restaurant_id,order_type,table_id,cashier_id,customer_name,customer_phone,instructions,status) values(r,(p_payload->>'orderType')::order_type,nullif(p_payload->>'tableId','')::uuid,auth.uid(),nullif(p_payload->>'customerName',''),nullif(p_payload->>'customerPhone',''),nullif(p_payload->>'instructions',''),'CONFIRMED') returning id into o;
 insert into kot_tickets(restaurant_id,order_id) values(r,o) returning id into k;
 for line in select * from jsonb_array_elements(p_payload->'items') loop
  select id,name,price_paise into strict item from menu_items where id=(line->>'menuItemId')::uuid and restaurant_id=r and active and available for share;
  variant:=null;variant_name:=null;delta:=0;line_total:=item.price_paise;
  if nullif(line->>'variantId','') is not null then select id,name,price_delta_paise into strict variant,variant_name,delta from menu_variants where id=(line->>'variantId')::uuid and menu_item_id=item.id and restaurant_id=r and active; line_total:=line_total+delta; end if;
  select coalesce(sum(a.price_paise),0),string_agg(a.name,', ') into addon_total,addon_names from addons a join menu_item_addons ma on ma.addon_id=a.id and ma.restaurant_id=a.restaurant_id where ma.menu_item_id=item.id and a.restaurant_id=r and a.active and a.id in(select jsonb_array_elements_text(line->'addonIds')::uuid);
  line_total:=(line_total+addon_total)*(line->>'quantity')::int;subtotal:=subtotal+line_total;
  insert into order_items(restaurant_id,order_id,menu_item_id,item_name,unit_price_paise,quantity,variant_id,variant_name,notes,line_total_paise,sent_to_kitchen) values(r,o,item.id,item.name,item.price_paise,(line->>'quantity')::int,variant,variant_name,nullif(line->>'notes',''),line_total,true) returning id into oi;
  insert into order_item_addons(restaurant_id,order_item_id,addon_id,addon_name,price_paise) select r,oi,a.id,a.name,a.price_paise from addons a join menu_item_addons ma on ma.addon_id=a.id and ma.restaurant_id=r where ma.menu_item_id=item.id and a.restaurant_id=r and a.id in(select jsonb_array_elements_text(line->'addonIds')::uuid);
  insert into kot_items(restaurant_id,kot_id,order_item_id,item_name,quantity,variant_name,addons_text,notes) values(r,k,oi,item.name,(line->>'quantity')::int,variant_name,addon_names,nullif(line->>'notes',''));
 end loop;
 if p_payload->>'discountType'='FIXED' then discount=least(subtotal,(p_payload->>'discountValue')::bigint); elsif p_payload->>'discountType'='PERCENTAGE' then discount=round(subtotal*least((p_payload->>'discountValue')::numeric,10000)/10000); end if;
 update orders set subtotal_paise=subtotal,discount_paise=discount,tax_paise=round((subtotal-discount)*tax::numeric/10000),service_charge_paise=round((subtotal-discount)*service::numeric/10000),total_paise=(subtotal-discount)+round((subtotal-discount)*tax::numeric/10000)+round((subtotal-discount)*service::numeric/10000) where id=o and restaurant_id=r;
 if p_payload->>'orderType'='DINE_IN' then update restaurant_tables set status='OCCUPIED' where id=(p_payload->>'tableId')::uuid and restaurant_id=r; end if; return o;
end $$;

create or replace function public.append_order_items_and_create_kot(p_order_id uuid,p_items jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare r uuid; st order_status; k uuid; line jsonb; item record; variant uuid; variant_name text; delta bigint; oi uuid; addon_total bigint; names text; total bigint; tax int; service int;
begin select restaurant_id,status into r,st from orders where id=p_order_id for update;if not found or not has_restaurant_role(r,array['OWNER','ADMIN','CASHIER']::restaurant_role[]) then raise exception 'Forbidden';end if;if st in('COMPLETED','CANCELLED')then raise exception 'Closed orders cannot be edited';end if;insert into kot_tickets(restaurant_id,order_id)values(r,p_order_id)returning id into k;
for line in select * from jsonb_array_elements(p_items)loop select * into strict item from menu_items where id=(line->>'menuItemId')::uuid and restaurant_id=r and active and available;variant:=null;variant_name:=null;delta:=0;total:=item.price_paise;if nullif(line->>'variantId','')is not null then select id,name,price_delta_paise into strict variant,variant_name,delta from menu_variants where id=(line->>'variantId')::uuid and menu_item_id=item.id and restaurant_id=r and active;total:=total+delta;end if;select coalesce(sum(a.price_paise),0),string_agg(a.name,', ')into addon_total,names from addons a join menu_item_addons m on m.addon_id=a.id and m.restaurant_id=r where m.menu_item_id=item.id and a.restaurant_id=r and a.id in(select jsonb_array_elements_text(line->'addonIds')::uuid);total=(total+addon_total)*(line->>'quantity')::int;insert into order_items(restaurant_id,order_id,menu_item_id,item_name,unit_price_paise,quantity,variant_id,variant_name,notes,line_total_paise,sent_to_kitchen)values(r,p_order_id,item.id,item.name,item.price_paise,(line->>'quantity')::int,variant,variant_name,nullif(line->>'notes',''),total,true)returning id into oi;insert into order_item_addons(restaurant_id,order_item_id,addon_id,addon_name,price_paise)select r,oi,a.id,a.name,a.price_paise from addons a join menu_item_addons m on m.addon_id=a.id and m.restaurant_id=r where m.menu_item_id=item.id and a.restaurant_id=r and a.id in(select jsonb_array_elements_text(line->'addonIds')::uuid);insert into kot_items(restaurant_id,kot_id,order_item_id,item_name,quantity,variant_name,addons_text,notes)values(r,k,oi,item.name,(line->>'quantity')::int,variant_name,names,nullif(line->>'notes',''));end loop;
select tax_basis_points,service_charge_basis_points into tax,service from restaurant_settings where restaurant_id=r;update orders o set subtotal_paise=x.subtotal,tax_paise=round((x.subtotal-o.discount_paise)*tax::numeric/10000),service_charge_paise=round((x.subtotal-o.discount_paise)*service::numeric/10000),total_paise=(x.subtotal-o.discount_paise)+round((x.subtotal-o.discount_paise)*tax::numeric/10000)+round((x.subtotal-o.discount_paise)*service::numeric/10000)from(select sum(line_total_paise)::bigint subtotal from order_items where order_id=p_order_id and restaurant_id=r)x where o.id=p_order_id and o.restaurant_id=r;return k;end $$;
grant execute on function create_order_with_kot(jsonb),append_order_items_and_create_kot(uuid,jsonb) to authenticated;

create or replace function public.update_kot_status(p_kot_id uuid,p_status kot_status)returns void language plpgsql security definer set search_path=public as $$declare r uuid;o uuid;begin select restaurant_id into r from kot_tickets where id=p_kot_id;if not has_restaurant_role(r,array['OWNER','ADMIN','KITCHEN']::restaurant_role[])then raise exception 'Forbidden';end if;update kot_tickets set status=p_status where id=p_kot_id and restaurant_id=r and((status='NEW'and p_status='PREPARING')or(status='PREPARING'and p_status='READY'))returning order_id into o;if not found then raise exception 'Invalid KOT transition';end if;if p_status='PREPARING'then update orders set status='PREPARING',guest_status=case when source='CUSTOMER_QR'then'PREPARING'else guest_status end where id=o and restaurant_id=r and status='CONFIRMED';elsif not exists(select 1 from kot_tickets where order_id=o and restaurant_id=r and status<>'READY')then update orders set status='READY',guest_status=case when source='CUSTOMER_QR'then'READY'else guest_status end where id=o and restaurant_id=r;end if;end$$;
create or replace function public.generate_order_bill(p_order_id uuid)returns void language plpgsql security definer set search_path=public as $$declare r uuid;t uuid;begin select restaurant_id into r from orders where id=p_order_id;if not has_restaurant_role(r,array['OWNER','ADMIN','CASHIER']::restaurant_role[])then raise exception 'Forbidden';end if;update orders set status='SERVED',guest_status=case when source='CUSTOMER_QR'then'SERVED'else guest_status end where id=p_order_id and restaurant_id=r and status='READY'returning table_id into t;if not found then raise exception 'Only ready orders can be billed';end if;if t is not null then update restaurant_tables set status='BILLING'where id=t and restaurant_id=r;end if;end$$;
create or replace function public.complete_order_payment(p_order_id uuid,p_method payment_method,p_idempotency_key uuid)returns void language plpgsql security definer set search_path=public as $$declare o orders%rowtype;begin select * into o from orders where id=p_order_id for update;if not found or not has_restaurant_role(o.restaurant_id,array['OWNER','ADMIN','CASHIER']::restaurant_role[])then raise exception 'Forbidden';end if;if exists(select 1 from payments where idempotency_key=p_idempotency_key and restaurant_id=o.restaurant_id)then return;end if;if o.status in('COMPLETED','CANCELLED')or o.payment_status='PAID'then raise exception 'Order is already closed';end if;insert into payments(restaurant_id,order_id,amount_paise,method,idempotency_key,received_by)values(o.restaurant_id,o.id,o.total_paise,p_method,p_idempotency_key,auth.uid());update orders set payment_status='PAID',payment_method=p_method,status='COMPLETED'where id=o.id and restaurant_id=o.restaurant_id;if o.table_id is not null then update restaurant_tables set status='AVAILABLE'where id=o.table_id and restaurant_id=o.restaurant_id;end if;end$$;

create or replace function public.regenerate_table_qr(p_table_id uuid,p_token_hash text)returns uuid language plpgsql security definer set search_path=public as $$declare r uuid;q uuid;begin select restaurant_id into r from restaurant_tables where id=p_table_id;if not has_restaurant_role(r,array['OWNER','ADMIN']::restaurant_role[])then raise exception 'Forbidden';end if;update table_qr_codes set active=false,deactivated_at=now()where table_id=p_table_id and restaurant_id=r and active;insert into table_qr_codes(restaurant_id,table_id,token_hash,generated_by)values(r,p_table_id,p_token_hash,auth.uid())returning id into q;insert into audit_logs(restaurant_id,actor_id,action,entity_type,entity_id,new_data)values(r,auth.uid(),'TABLE_QR_REGENERATED','restaurant_table',p_table_id,jsonb_build_object('qrCodeId',q));return q;end$$;

create or replace function public.open_guest_session(p_qr_hash text,p_session_hash text)returns jsonb language plpgsql security definer set search_path=public as $$declare r uuid;t uuid;tn text;q uuid;v uuid;s uuid;rn text;begin select x.restaurant_id,x.id,rt.id,rt.name,restaurants.name into r,q,t,tn,rn from table_qr_codes x join restaurant_tables rt on rt.id=x.table_id and rt.restaurant_id=x.restaurant_id join restaurants on restaurants.id=x.restaurant_id where x.token_hash=p_qr_hash and x.active and rt.active and restaurants.status='ACTIVE';if not found then raise exception 'This restaurant or QR code is unavailable';end if;perform pg_advisory_xact_lock(hashtextextended(t::text,0));select id into v from table_visits where table_id=t and restaurant_id=r and status='OPEN'order by started_at desc limit 1;if v is null then insert into table_visits(restaurant_id,table_id)values(r,t)returning id into v;end if;insert into guest_sessions(restaurant_id,session_hash,qr_code_id,table_id,visit_id)values(r,p_session_hash,q,t,v)returning id into s;return jsonb_build_object('restaurantId',r,'sessionId',s,'visitId',v,'tableId',t,'tableName',tn,'restaurantName',rn);end$$;

create or replace function public.create_guest_order(p_guest_session_id uuid,p_submission_key uuid,p_customer_name text,p_instructions text,p_items jsonb)returns uuid language plpgsql security definer set search_path=public as $$
declare gs guest_sessions%rowtype;r uuid;o uuid;k uuid;line jsonb;item record;variant uuid;variant_name text;delta bigint;oi uuid;addon_total bigint;subtotal bigint:=0;tax int;service int;line_total bigint;addon_names text;existing uuid;
begin select id into existing from orders where guest_session_id=p_guest_session_id and guest_submission_key=p_submission_key;if existing is not null then return existing;end if;select x.* into gs from guest_sessions x join table_visits v on v.id=x.visit_id and v.restaurant_id=x.restaurant_id join restaurants rr on rr.id=x.restaurant_id where x.id=p_guest_session_id and x.expires_at>now()and v.status='OPEN'and rr.status='ACTIVE'for update of x;if not found then raise exception 'Your table session has expired';end if;r:=gs.restaurant_id;if length(trim(p_customer_name))<1 or jsonb_array_length(p_items)<1 then raise exception 'Invalid order';end if;if(select count(*)from orders where guest_session_id=p_guest_session_id and restaurant_id=r and created_at>now()-interval'1 minute')>=3 then raise exception 'Too many orders submitted';end if;select tax_basis_points,service_charge_basis_points into tax,service from restaurant_settings where restaurant_id=r;insert into orders(restaurant_id,order_type,status,table_id,cashier_id,customer_name,instructions,source,guest_session_id,table_visit_id,guest_status,guest_submission_key)values(r,'DINE_IN','CONFIRMED',gs.table_id,null,trim(p_customer_name),nullif(trim(p_instructions),''),'CUSTOMER_QR',gs.id,gs.visit_id,'PLACED',p_submission_key)returning id into o;insert into kot_tickets(restaurant_id,order_id)values(r,o)returning id into k;
for line in select * from jsonb_array_elements(p_items)loop if(line->>'quantity')::int not between 1 and 20 then raise exception 'Invalid quantity';end if;select id,name,price_paise into strict item from menu_items where id=(line->>'menuItemId')::uuid and restaurant_id=r and active and available for share;line_total:=item.price_paise;variant:=null;variant_name:=null;delta:=0;if nullif(line->>'variantId','')is not null then select id,name,price_delta_paise into strict variant,variant_name,delta from menu_variants where id=(line->>'variantId')::uuid and menu_item_id=item.id and restaurant_id=r and active;line_total:=line_total+delta;end if;select coalesce(sum(a.price_paise),0),string_agg(a.name,', ')into addon_total,addon_names from addons a join menu_item_addons ma on ma.addon_id=a.id and ma.restaurant_id=r where ma.menu_item_id=item.id and a.restaurant_id=r and a.active and a.id in(select jsonb_array_elements_text(coalesce(line->'addonIds','[]'::jsonb))::uuid);line_total:=(line_total+addon_total)*(line->>'quantity')::int;subtotal:=subtotal+line_total;insert into order_items(restaurant_id,order_id,menu_item_id,item_name,unit_price_paise,quantity,variant_id,variant_name,notes,line_total_paise,sent_to_kitchen)values(r,o,item.id,item.name,item.price_paise,(line->>'quantity')::int,variant,variant_name,nullif(trim(line->>'notes'),''),line_total,true)returning id into oi;insert into order_item_addons(restaurant_id,order_item_id,addon_id,addon_name,price_paise)select r,oi,a.id,a.name,a.price_paise from addons a join menu_item_addons ma on ma.addon_id=a.id and ma.restaurant_id=r where ma.menu_item_id=item.id and a.restaurant_id=r and a.active and a.id in(select jsonb_array_elements_text(coalesce(line->'addonIds','[]'::jsonb))::uuid);insert into kot_items(restaurant_id,kot_id,order_item_id,item_name,quantity,variant_name,addons_text,notes)values(r,k,oi,item.name,(line->>'quantity')::int,variant_name,addon_names,nullif(trim(line->>'notes'),''));end loop;update orders set subtotal_paise=subtotal,tax_paise=round(subtotal*tax::numeric/10000),service_charge_paise=round(subtotal*service::numeric/10000),total_paise=subtotal+round(subtotal*tax::numeric/10000)+round(subtotal*service::numeric/10000)where id=o and restaurant_id=r;update restaurant_tables set status='OCCUPIED'where id=gs.table_id and restaurant_id=r;update guest_sessions set last_seen_at=now()where id=gs.id and restaurant_id=r;return o;end$$;

create or replace function public.submit_guest_payment_claim(p_guest_session_id uuid,p_order_id uuid,p_reference text)returns uuid language plpgsql security definer set search_path=public as $$declare o orders%rowtype;c uuid;begin select * into o from orders where id=p_order_id and guest_session_id=p_guest_session_id for update;if not found then raise exception 'Order does not belong to this guest session';end if;if not exists(select 1 from restaurants where id=o.restaurant_id and status='ACTIVE')then raise exception 'Restaurant unavailable';end if;if o.guest_payment_state='PAID'then raise exception 'This bill is already marked paid';end if;select id into c from guest_payment_claims where order_id=o.id and restaurant_id=o.restaurant_id and status='AWAITING_VERIFICATION';if c is not null then return c;end if;insert into guest_payment_claims(restaurant_id,order_id,guest_session_id,amount_paise,transaction_reference)values(o.restaurant_id,o.id,p_guest_session_id,o.total_paise,nullif(trim(p_reference),''))returning id into c;update orders set guest_payment_state='AWAITING_VERIFICATION'where id=o.id and restaurant_id=o.restaurant_id;return c;end$$;

grant execute on function regenerate_table_qr(uuid,text) to authenticated;
create or replace function public.accept_guest_order(p_order_id uuid)returns void language plpgsql security definer set search_path=public as $$declare r uuid;begin select restaurant_id into r from orders where id=p_order_id;if not has_restaurant_role(r,array['OWNER','ADMIN','CASHIER','KITCHEN']::restaurant_role[])then raise exception 'Forbidden';end if;update orders set guest_status='ACCEPTED'where id=p_order_id and restaurant_id=r and source='CUSTOMER_QR'and guest_status='PLACED'and status='CONFIRMED';if not found then raise exception 'Order cannot be accepted';end if;end$$;
create or replace function public.set_order_estimate(p_order_id uuid,p_minutes integer)returns void language plpgsql security definer set search_path=public as $$declare r uuid;begin select restaurant_id into r from orders where id=p_order_id;if not has_restaurant_role(r,array['OWNER','ADMIN','CASHIER','KITCHEN']::restaurant_role[])or p_minutes not between 1 and 240 then raise exception 'Forbidden or invalid estimate';end if;update orders set estimated_ready_at=now()+make_interval(mins=>p_minutes)where id=p_order_id and restaurant_id=r and status not in('COMPLETED','CANCELLED');end$$;
create or replace function public.close_table_visit(p_table_id uuid)returns void language plpgsql security definer set search_path=public as $$declare r uuid;begin select restaurant_id into r from restaurant_tables where id=p_table_id;if not has_restaurant_role(r,array['OWNER','ADMIN','CASHIER']::restaurant_role[])then raise exception 'Forbidden';end if;update table_visits set status='CLOSED',closed_at=now(),closed_by=auth.uid()where table_id=p_table_id and restaurant_id=r and status='OPEN';update restaurant_tables set status='AVAILABLE'where id=p_table_id and restaurant_id=r;insert into audit_logs(restaurant_id,actor_id,action,entity_type,entity_id,new_data)values(r,auth.uid(),'TABLE_VISIT_CLOSED','restaurant_table',p_table_id,jsonb_build_object('closedAt',now()));end$$;
create or replace function public.cancel_order(p_order_id uuid,p_reason text)returns void language plpgsql security definer set search_path=public as $$declare o orders%rowtype;begin select * into o from orders where id=p_order_id for update;if not found or not has_restaurant_role(o.restaurant_id,array['OWNER','ADMIN','CASHIER']::restaurant_role[])or length(trim(p_reason))<3 then raise exception 'Forbidden or invalid reason';end if;if o.status in('COMPLETED','CANCELLED')then raise exception 'Closed orders cannot be cancelled';end if;update orders set status='CANCELLED',guest_status=case when source='CUSTOMER_QR'then'CANCELLED'else guest_status end,cancellation_reason=trim(p_reason),cancelled_by=auth.uid(),cancelled_at=now()where id=o.id and restaurant_id=o.restaurant_id;if o.table_id is not null and not exists(select 1 from orders where table_id=o.table_id and restaurant_id=o.restaurant_id and id<>o.id and status not in('COMPLETED','CANCELLED'))then update restaurant_tables set status='AVAILABLE'where id=o.table_id and restaurant_id=o.restaurant_id;end if;insert into audit_logs(restaurant_id,actor_id,action,entity_type,entity_id,new_data)values(o.restaurant_id,auth.uid(),'ORDER_CANCELLED','order',o.id,jsonb_build_object('status','CANCELLED','reason',trim(p_reason)));end$$;
create or replace function public.verify_guest_payment(p_claim_id uuid,p_approved boolean,p_reason text default null)returns void language plpgsql security definer set search_path=public as $$declare c guest_payment_claims%rowtype;o orders%rowtype;begin select * into c from guest_payment_claims where id=p_claim_id and status='AWAITING_VERIFICATION'for update;if not found or not has_restaurant_role(c.restaurant_id,array['OWNER','ADMIN','CASHIER']::restaurant_role[])then raise exception 'Forbidden';end if;select * into o from orders where id=c.order_id and restaurant_id=c.restaurant_id for update;if p_approved then update guest_payment_claims set status='VERIFIED',verified_by=auth.uid(),verified_at=now()where id=c.id and restaurant_id=c.restaurant_id;update orders set guest_payment_state='PAID',payment_status='PAID',payment_method='UPI'where id=o.id and restaurant_id=o.restaurant_id;insert into payments(restaurant_id,order_id,amount_paise,method,status,idempotency_key,received_by)values(o.restaurant_id,o.id,c.amount_paise,'UPI','PAID',c.id,auth.uid())on conflict(idempotency_key)do nothing;else if length(trim(coalesce(p_reason,'')))<3 then raise exception 'A rejection reason is required';end if;update guest_payment_claims set status='REJECTED',verified_by=auth.uid(),verified_at=now(),rejection_reason=trim(p_reason)where id=c.id and restaurant_id=c.restaurant_id;update orders set guest_payment_state='REJECTED'where id=o.id and restaurant_id=o.restaurant_id;end if;end$$;

-- Storage objects must be stored as <restaurant_uuid>/... and are membership protected.
create policy restaurant_storage_read on storage.objects for select to authenticated using(bucket_id='restaurant-assets' and (storage.foldername(name))[1]~*'^[0-9a-f-]{36}$' and public.is_restaurant_member((storage.foldername(name))[1]::uuid));
create policy restaurant_storage_write on storage.objects for all to authenticated using(bucket_id='restaurant-assets' and (storage.foldername(name))[1]~*'^[0-9a-f-]{36}$' and public.has_restaurant_role((storage.foldername(name))[1]::uuid,array['OWNER','ADMIN']::restaurant_role[])) with check(bucket_id='restaurant-assets' and (storage.foldername(name))[1]~*'^[0-9a-f-]{36}$' and public.has_restaurant_role((storage.foldername(name))[1]::uuid,array['OWNER','ADMIN']::restaurant_role[]));

do $$ begin alter publication supabase_realtime add table public.restaurant_members; exception when duplicate_object then null; end $$;

-- PostgreSQL grants EXECUTE to PUBLIC by default. Close that implicit path for every
-- security-definer entry point and grant only the intended API roles.
revoke all on function create_order_with_kot(jsonb),append_order_items_and_create_kot(uuid,jsonb),update_kot_status(uuid,kot_status),generate_order_bill(uuid),complete_order_payment(uuid,payment_method,uuid),cancel_order(uuid,text),regenerate_table_qr(uuid,text),accept_guest_order(uuid),set_order_estimate(uuid,integer),close_table_visit(uuid),verify_guest_payment(uuid,boolean,text),accept_staff_invitation(text),platform_set_restaurant_status(uuid,restaurant_status),platform_metrics(),dashboard_metrics(uuid),sales_last_seven_days(uuid),top_selling_items(uuid,int),item_sales_report(uuid),payment_method_report(uuid),sales_report(uuid,text) from public;
grant execute on function create_order_with_kot(jsonb),append_order_items_and_create_kot(uuid,jsonb),update_kot_status(uuid,kot_status),generate_order_bill(uuid),complete_order_payment(uuid,payment_method,uuid),cancel_order(uuid,text),regenerate_table_qr(uuid,text),accept_guest_order(uuid),set_order_estimate(uuid,integer),close_table_visit(uuid),verify_guest_payment(uuid,boolean,text),accept_staff_invitation(text),platform_set_restaurant_status(uuid,restaurant_status),platform_metrics(),dashboard_metrics(uuid),sales_last_seven_days(uuid),top_selling_items(uuid,int),item_sales_report(uuid),payment_method_report(uuid),sales_report(uuid,text) to authenticated;
