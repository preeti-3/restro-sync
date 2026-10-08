import { Building2, CheckCircle2, Clock3, ShoppingBag } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, EmptyState } from "@/components/ui/primitives";
import { RestaurantActions } from "@/components/platform/restaurant-actions";

type RestaurantRow = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  owner_name: string | null;
  owner_email: string | null;
  created_at: string;
  order_count: number;
  status: "ACTIVE" | "SUSPENDED" | "PENDING";
};

function statusTone(status: RestaurantRow["status"]) {
  return status === "ACTIVE" ? "success" : status === "SUSPENDED" ? "danger" : "warning";
}

export default async function PlatformPage() {
  const supabase = await createClient();
  const [{ data: restaurants }, { data: metrics }] = await Promise.all([
    supabase.from("platform_restaurant_overview").select("*").order("created_at", { ascending: false }),
    supabase.rpc("platform_metrics"),
  ]);
  const m = metrics?.[0] ?? {};
  const cards = [
    { label: "Restaurants", value: m.total_restaurants ?? 0, icon: Building2 },
    { label: "Pending approval", value: m.pending_restaurants ?? 0, icon: Clock3 },
    { label: "Active", value: m.active_restaurants ?? 0, icon: CheckCircle2 },
    { label: "Orders (30 days)", value: m.orders_30d ?? 0, icon: ShoppingBag },
  ];
  const rows = (restaurants ?? []) as RestaurantRow[];

  return (
    <div className="min-w-0 space-y-6">
      <div>
        <p className="text-sm font-semibold text-primary">Platform administration</p>
        <h1 className="mt-1 font-display text-2xl font-bold tracking-tight sm:text-3xl">Platform overview</h1>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">Approve restaurants and monitor tenant activity.</p>
      </div>

      <section aria-label="Platform metrics" className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, icon: Icon }) => (
          <Card key={label} className="p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-muted-foreground">{label}</p>
                <p className="mt-2 font-display text-2xl font-bold tabular-nums sm:text-3xl">{value}</p>
              </div>
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-primary">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
            </div>
          </Card>
        ))}
      </section>

      <Card className="overflow-hidden">
        <div className="border-b p-4 sm:p-5">
          <h2 className="font-display font-semibold">Registered restaurants</h2>
          <p className="mt-1 text-sm text-muted-foreground">Review account status and recent order activity.</p>
        </div>
        {rows.length ? (
          <>
            <div className="divide-y md:hidden">
              {rows.map((restaurant) => (
                <article key={restaurant.id} className="space-y-4 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold">{restaurant.name}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{restaurant.owner_name || "Owner not provided"}</p>
                    </div>
                    <Badge tone={statusTone(restaurant.status)}>{restaurant.status}</Badge>
                  </div>
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-xs text-muted-foreground">Registered</dt>
                      <dd className="mt-1 font-medium">{new Date(restaurant.created_at).toLocaleDateString("en-IN")}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Activity</dt>
                      <dd className="mt-1 font-medium tabular-nums">{restaurant.order_count} orders</dd>
                    </div>
                  </dl>
                  <div className="break-words text-xs leading-5 text-muted-foreground">
                    <p>{restaurant.owner_email}</p>
                    <p>{[restaurant.phone, restaurant.address].filter(Boolean).join(" · ")}</p>
                  </div>
                  <RestaurantActions id={restaurant.id} status={restaurant.status} />
                </article>
              ))}
            </div>
            <div className="hidden max-w-full overflow-x-auto md:block">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="p-4">Restaurant</th><th className="p-4">Owner</th><th className="p-4">Registered</th><th className="p-4">Activity</th><th className="p-4">Status</th><th className="p-4">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((restaurant) => (
                    <tr key={restaurant.id} className="border-t hover:bg-slate-50/70">
                      <td className="p-4"><p className="font-semibold">{restaurant.name}</p><p className="mt-1 max-w-xs truncate text-xs text-muted-foreground">{restaurant.phone} · {restaurant.address}</p></td>
                      <td className="p-4"><p>{restaurant.owner_name}</p><p className="text-xs text-muted-foreground">{restaurant.owner_email}</p></td>
                      <td className="whitespace-nowrap p-4">{new Date(restaurant.created_at).toLocaleDateString("en-IN")}</td>
                      <td className="whitespace-nowrap p-4 tabular-nums">{restaurant.order_count} orders</td>
                      <td className="p-4"><Badge tone={statusTone(restaurant.status)}>{restaurant.status}</Badge></td>
                      <td className="p-4"><RestaurantActions id={restaurant.id} status={restaurant.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="p-4 sm:p-6"><EmptyState icon={Building2} title="No restaurants" description="New registrations will appear here." /></div>
        )}
      </Card>
    </div>
  );
}
