import { redirect } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { getGuestContext } from "@/lib/guest/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/primitives";
import { CustomerMenu } from "@/components/customer/customer-menu";
import type { MenuItem } from "@/types";

export default async function CustomerOrderPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ reason?: string }> }) {
  const { token } = await params;
  const query = await searchParams;
  if (token === "invalid" || token.length < 32) return <main className="grid min-h-dvh place-items-center bg-slate-50 p-4"><Card className="max-w-md p-8 text-center"><AlertTriangle className="mx-auto h-10 w-10 text-amber-600"/><h1 className="mt-4 font-display text-2xl font-bold">This QR code is not active</h1><p className="mt-2 text-muted-foreground">{query.reason || "Ask a staff member for the current table QR code."}</p></Card></main>;

  const context = await getGuestContext(token, true);
  if (!context) redirect(`/api/guest/session?table=${encodeURIComponent(token)}`);
  const admin = createAdminClient();
  const [{ data: settings }, { data: categories }, { data: rawItems, error: menuError }, { data: orders }] = await Promise.all([
    admin.from("restaurant_settings").select("restaurant_name,tax_basis_points,service_charge_basis_points").eq("restaurant_id", context.restaurantId).single(),
    admin.from("categories").select("*").eq("restaurant_id", context.restaurantId).eq("active", true).order("sort_order"),
    admin.from("menu_items").select("*,menu_variants!menu_variants_item_tenant_fk(*),menu_item_addons!menu_item_addons_item_tenant_fk(addons!menu_item_addons_addon_tenant_fk(*))").eq("restaurant_id", context.restaurantId).eq("active", true).order("name"),
    admin.from("orders").select("id,order_number,guest_status,created_at").eq("restaurant_id", context.restaurantId).eq("guest_session_id", context.sessionId).order("created_at", { ascending: false }),
  ]);
  if (menuError) throw new Error(`Unable to load the customer menu: ${menuError.message}`);
  const items = (rawItems ?? []).map((item) => ({ ...item, addons: item.menu_item_addons?.map((link: { addons: unknown }) => link.addons).filter(Boolean) ?? [] })) as MenuItem[];

  return <CustomerMenu tableToken={token} restaurantName={settings?.restaurant_name ?? "Restaurant"} tableName={context.tableName} categories={categories ?? []} items={items} previousOrders={orders ?? []} />;
}
