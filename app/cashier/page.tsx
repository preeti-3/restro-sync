import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { GuestOrderDesk } from "@/components/cashier/guest-order-desk";
import { Pos } from "@/components/cashier/pos";
import type { MenuItem, Order } from "@/types";

export default async function CashierPage() {
  const profile = await requireRole("OWNER", "ADMIN", "CASHIER");
  const restaurantId = profile.membership.restaurant_id;
  const supabase = await createClient();
  const [{ data: categories }, { data: rawItems, error: menuError }, { data: tables }, { data: orders }, { data: settings }] = await Promise.all([
    supabase.from("categories").select("*").eq("restaurant_id", restaurantId).eq("active", true).order("sort_order"),
    supabase.from("menu_items").select("*,menu_variants!menu_variants_item_tenant_fk(*),menu_item_addons!menu_item_addons_item_tenant_fk(addons!menu_item_addons_addon_tenant_fk(*))").eq("restaurant_id", restaurantId).eq("active", true).order("name"),
    supabase.from("restaurant_tables").select("*").eq("restaurant_id", restaurantId).eq("active", true).order("name"),
    supabase.from("orders").select("*,restaurant_tables!orders_table_tenant_fk(id,name),order_items!order_items_order_tenant_fk(*),guest_payment_claims!claims_order_tenant_fk(*)").eq("restaurant_id", restaurantId).not("status", "in", "(COMPLETED,CANCELLED)").order("created_at", { ascending: false }).limit(50),
    supabase.from("restaurant_settings").select("tax_basis_points,service_charge_basis_points").eq("restaurant_id", restaurantId).maybeSingle(),
  ]);

  if (menuError) throw new Error(`Unable to load the cashier menu: ${menuError.message}`);

  const items = (rawItems ?? []).map((item) => ({
    ...item,
    addons: item.menu_item_addons?.map((link: { addons: unknown }) => link.addons).filter(Boolean) ?? [],
  })) as MenuItem[];
  const activeOrders = (orders ?? []) as Order[];
  const guestOrders = activeOrders.filter((order) => order.source === "CUSTOMER_QR");

  return <>
    <GuestOrderDesk orders={guestOrders} restaurantId={restaurantId} />
    <Pos
      restaurantId={restaurantId}
      categories={categories ?? []}
      items={items}
      tables={tables ?? []}
      activeOrders={activeOrders.slice(0, 30)}
      taxBasisPoints={settings?.tax_basis_points ?? 0}
      serviceChargeBasisPoints={settings?.service_charge_basis_points ?? 0}
    />
  </>;
}
