import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { KitchenBoard } from "@/components/kitchen/kitchen-board";

export default async function KitchenPage() {
  const profile = await requireRole("OWNER", "ADMIN", "KITCHEN");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kot_tickets")
    .select("*,order:orders!kot_order_tenant_fk(order_number,order_type,customer_name,instructions,source,guest_status,estimated_ready_at,created_at,restaurant_tables!orders_table_tenant_fk(name)),kot_items!kot_items_kot_tenant_fk(*)")
    .eq("restaurant_id", profile.membership.restaurant_id)
    .order("created_at")
    .limit(100);

  if (error) throw new Error(`Unable to load the kitchen queue: ${error.message}`);
  return <KitchenBoard initialTickets={data ?? []} restaurantId={profile.membership.restaurant_id} />;
}
