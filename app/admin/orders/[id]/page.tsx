import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { Badge, Card } from "@/components/ui/primitives";
import { formatMoney } from "@/lib/utils";

export default async function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireRole("OWNER", "ADMIN");
  const supabase = await createClient();
  const { data: order, error } = await supabase.from("orders").select("*,restaurant_tables!orders_table_tenant_fk(name),order_items!order_items_order_tenant_fk(*,order_item_addons!order_item_addons_item_tenant_fk(*)),payments!payments_order_tenant_fk(*)").eq("restaurant_id", profile.membership.restaurant_id).eq("id", id).maybeSingle();
  if (error) throw new Error(`Unable to load order: ${error.message}`);
  if (!order) notFound();

  return <div className="mx-auto max-w-4xl space-y-6">
    <div className="flex items-end justify-between"><div><p className="text-sm text-muted-foreground">Order details</p><h1 className="font-display text-2xl font-bold">{order.order_number}</h1></div><Badge tone={order.status === "COMPLETED" ? "success" : order.status === "CANCELLED" ? "danger" : "info"}>{order.status}</Badge></div>
    <Card className="p-5"><div className="grid gap-4 text-sm sm:grid-cols-3"><div><p className="text-muted-foreground">Order type</p><p className="font-semibold">{order.order_type}</p></div><div><p className="text-muted-foreground">Customer</p><p className="font-semibold">{order.customer_name || "Walk-in"}</p></div><div><p className="text-muted-foreground">Created</p><p className="font-semibold">{new Date(order.created_at).toLocaleString("en-IN")}</p></div></div></Card>
    <Card className="overflow-hidden"><table className="w-full text-left text-sm"><thead className="bg-slate-50"><tr><th className="p-4">Item</th><th className="p-4">Qty</th><th className="p-4 text-right">Amount</th></tr></thead><tbody>{order.order_items.map((item: { id: string; item_name: string; variant_name: string | null; quantity: number; line_total_paise: number }) => <tr key={item.id} className="border-t"><td className="p-4 font-semibold">{item.item_name}{item.variant_name && <span className="ml-2 text-xs text-muted-foreground">{item.variant_name}</span>}</td><td className="p-4">{item.quantity}</td><td className="p-4 text-right">{formatMoney(item.line_total_paise)}</td></tr>)}</tbody><tfoot className="border-t bg-slate-50 font-semibold"><tr><td colSpan={2} className="p-4">Total</td><td className="p-4 text-right">{formatMoney(order.total_paise)}</td></tr></tfoot></table></Card>
    {order.cancellation_reason && <Card className="border-red-200 bg-red-50 p-5"><p className="font-semibold text-red-800">Cancellation reason</p><p className="text-sm text-red-700">{order.cancellation_reason}</p></Card>}
  </div>;
}
