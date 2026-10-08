-- Avoid recursive RLS evaluation when a membership query embeds its restaurant.
-- This helper intentionally ignores restaurant status so pending/suspended owners
-- can still see the restaurant identity needed for the appropriate status screen.
create or replace function public.has_any_restaurant_membership(p_restaurant uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists(
    select 1
    from public.restaurant_members
    where user_id=auth.uid()
      and restaurant_id=p_restaurant
      and active
  )
$$;

revoke all on function public.has_any_restaurant_membership(uuid) from public;
grant execute on function public.has_any_restaurant_membership(uuid) to authenticated;

drop policy if exists restaurants_visible on public.restaurants;
create policy restaurants_visible
on public.restaurants
for select
to authenticated
using (
  public.is_platform_admin()
  or public.has_any_restaurant_membership(id)
);
