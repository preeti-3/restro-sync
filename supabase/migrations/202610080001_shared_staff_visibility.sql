-- Owners and administrators need a complete team roster for their restaurant.
-- Mutation policies remain owner-only; this migration only broadens SELECT.
drop policy if exists memberships_visible on public.restaurant_members;
create policy memberships_visible
on public.restaurant_members
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_platform_admin()
  or public.has_restaurant_role(
    restaurant_id,
    array['OWNER', 'ADMIN']::public.restaurant_role[]
  )
);

drop policy if exists profiles_restaurant_management_read on public.profiles;
create policy profiles_restaurant_management_read
on public.profiles
for select
to authenticated
using (
  exists (
    select 1
    from public.restaurant_members target
    join public.restaurant_members viewer
      on viewer.restaurant_id = target.restaurant_id
    where target.user_id = profiles.id
      and viewer.user_id = auth.uid()
      and viewer.active
      and viewer.role in ('OWNER', 'ADMIN')
  )
);
