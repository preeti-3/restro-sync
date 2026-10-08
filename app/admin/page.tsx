import {
  Banknote,
  CheckCircle2,
  Circle,
  CircleX,
  CreditCard,
  IndianRupee,
  ReceiptText,
  ShoppingBag,
  Smartphone,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, Badge, EmptyState } from "@/components/ui/primitives";
import { SalesChart } from "@/components/admin/sales-chart";
import { formatMoney } from "@/lib/utils";
import { requireRole } from "@/lib/auth/session";

export default async function AdminDashboard() {
  const profile = await requireRole("OWNER","ADMIN");
  const restaurantId = profile.membership.restaurant_id;
  const supabase = await createClient();
  const [{ data: metrics }, { data: sales }, { data: recent }, { data: top },{count:menuCount},{count:tableCount},{count:staffCount},{data:setup}] =
    await Promise.all([
      supabase.rpc("dashboard_metrics",{p_restaurant_id:restaurantId}),
      supabase.rpc("sales_last_seven_days",{p_restaurant_id:restaurantId}),
      supabase
        .from("orders")
        .select("id,order_number,status,total_paise,created_at")
        .eq("restaurant_id",restaurantId)
        .order("created_at", { ascending: false })
        .limit(6),
      supabase.rpc("top_selling_items", { p_restaurant_id:restaurantId,p_limit: 5 }),
      supabase.from("menu_items").select("id",{count:"exact",head:true}).eq("restaurant_id",restaurantId),
      supabase.from("restaurant_tables").select("id",{count:"exact",head:true}).eq("restaurant_id",restaurantId),
      supabase.from("restaurant_members").select("id",{count:"exact",head:true}).eq("restaurant_id",restaurantId).eq("active",true),
      supabase.from("restaurant_settings").select("upi_id").eq("restaurant_id",restaurantId).maybeSingle(),
    ]);
  const m = metrics?.[0] ?? {};
  const cards = [
    {
      label: "Today's sales",
      value: formatMoney(m.total_sales_paise ?? 0),
      icon: IndianRupee,
      iconStyle: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    },
    {
      label: "Total orders",
      value: String(m.total_orders ?? 0),
      icon: ShoppingBag,
      iconStyle: "bg-blue-50 text-blue-700 ring-blue-100",
    },
    {
      label: "Completed",
      value: String(m.completed_orders ?? 0),
      icon: CheckCircle2,
      iconStyle: "bg-violet-50 text-violet-700 ring-violet-100",
    },
    {
      label: "Cancelled",
      value: String(m.cancelled_orders ?? 0),
      icon: CircleX,
      iconStyle: "bg-rose-50 text-rose-700 ring-rose-100",
    },
    { label: "Cash", value: formatMoney(m.cash_paise ?? 0), icon: Banknote, iconStyle: "bg-amber-50 text-amber-700 ring-amber-100" },
    { label: "UPI", value: formatMoney(m.upi_paise ?? 0), icon: Smartphone, iconStyle: "bg-cyan-50 text-cyan-700 ring-cyan-100" },
    { label: "Card", value: formatMoney(m.card_paise ?? 0), icon: CreditCard, iconStyle: "bg-slate-100 text-slate-700 ring-slate-200" },
  ];
  return (
    <div className="min-w-0 space-y-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5" aria-hidden="true"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50"/><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"/></span>
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">Live today</span>
          </div>
        <h1 className="max-w-4xl font-display text-2xl font-bold tracking-tight sm:text-3xl">
          Good day. Here’s your restaurant at a glance.
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Live operating numbers for today.
        </p>
        </div>
        <Link href="/admin/reports" prefetch={false} className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-xl border bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-primary sm:self-auto">
          View reports <ArrowRight className="h-4 w-4" aria-hidden="true"/>
        </Link>
      </div>
      {profile.membership.role==="OWNER"&&(!menuCount||!tableCount||!setup?.upi_id||(staffCount??0)<2)&&<Card className="border-blue-200 bg-blue-50 p-4 sm:p-5"><div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_auto]"><div className="min-w-0"><p className="text-sm font-semibold text-primary">Finish your restaurant setup</p><h2 className="mt-1 font-display text-lg font-bold sm:text-xl">Get ready to take your first order</h2><p className="mt-1 text-sm text-slate-600">Complete each workspace step after platform approval.</p></div><div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">{[["Menu",menuCount,"/admin/menu"],["Tables",tableCount,"/admin/tables"],["UPI details",setup?.upi_id?1:0,"/admin/settings"],["Staff",(staffCount??0)>1?1:0,"/admin/staff"]].map(([label,done,href])=><a key={String(label)} href={String(href)} className="flex min-h-11 min-w-0 items-center justify-between gap-3 rounded-lg border border-blue-100 bg-white px-3 text-sm font-semibold transition-colors hover:border-blue-300"><span className="flex min-w-0 items-center gap-2">{done?<CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600"/>:<Circle className="h-4 w-4 shrink-0 text-slate-400"/>}<span className="truncate">{label}</span></span><ArrowRight className="h-4 w-4 shrink-0 text-primary"/></a>)}</div></div></Card>}
      <section aria-label="Today's restaurant metrics" className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, icon: Icon, iconStyle }) => (
          <Card key={label} className="group p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_12px_32px_rgba(15,23,42,0.07)] sm:p-5">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-muted-foreground">
                  {label}
                </p>
                <p className="mt-2 truncate font-display text-2xl font-bold tracking-tight tabular-nums text-slate-950">{value}</p>
              </div>
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ring-1 transition-transform duration-200 group-hover:scale-105 ${iconStyle}`}>
                <Icon className="h-5 w-5" />
              </span>
            </div>
          </Card>
        ))}
      </section>
      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card className="overflow-hidden p-4 sm:p-6">
          <div className="mb-5 flex items-start justify-between">
            <div><h2 className="font-display font-bold text-slate-900">Sales trend</h2><p className="mt-0.5 text-sm text-muted-foreground">Revenue over the last seven days</p></div>
            <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">7 days</span>
          </div>
          <SalesChart data={sales ?? []} />
        </Card>
        <Card className="p-5 sm:p-6">
          <h2 className="font-display font-bold text-slate-900">Best-selling items</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">What customers order most</p>
          <div className="mt-4 space-y-4">
            {top?.length ? (
              top.map(
                (
                  item: {
                    item_name: string;
                    quantity: number;
                    sales_paise: number;
                  },
                  i: number,
                ) => (
                  <div key={item.item_name} className="flex items-center gap-3">
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-sm font-bold">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {item.item_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.quantity} sold
                      </p>
                    </div>
                    <span className="text-sm font-semibold">
                      {formatMoney(item.sales_paise)}
                    </span>
                  </div>
                ),
              )
            ) : (
              <EmptyState
                icon={ReceiptText}
                title="No sales yet"
                description="Popular items appear after completed orders."
              />
            )}
          </div>
        </Card>
      </div>
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b p-5 sm:px-6">
          <div><h2 className="font-display font-bold text-slate-900">Recent orders</h2><p className="mt-0.5 text-sm text-muted-foreground">Latest activity from your order queue</p></div>
          <Link href="/admin/orders" prefetch={false} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-primary transition-colors hover:bg-blue-50">View all <ArrowRight className="h-4 w-4" aria-hidden="true"/></Link>
        </div>
        {recent?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-4">Order</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Time</th>
                  <th className="p-4 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((order) => (
                  <tr key={order.id} className="border-t transition-colors hover:bg-slate-50/80">
                    <td className="p-4 font-semibold">{order.order_number}</td>
                    <td className="p-4">
                      <Badge
                        tone={
                          order.status === "CANCELLED"
                            ? "danger"
                            : order.status === "COMPLETED"
                              ? "success"
                              : "info"
                        }
                      >
                        {order.status}
                      </Badge>
                    </td>
                    <td className="p-4 text-muted-foreground">
                      {new Date(order.created_at).toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="p-4 text-right font-semibold">
                      {formatMoney(order.total_paise)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-5">
            <EmptyState
              icon={ReceiptText}
              title="No orders today"
              description="Orders will show here as the cashier creates them."
            />
          </div>
        )}
      </Card>
    </div>
  );
}
