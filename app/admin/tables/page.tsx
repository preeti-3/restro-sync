import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { TableManager } from "@/components/admin/table-manager";

export default async function TablesPage() {
  const profile = await requireRole("OWNER", "ADMIN");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("restaurant_tables")
    .select("*,table_qr_codes!qr_table_tenant_fk(id,active,created_at),table_visits!visit_table_tenant_fk(id,status,started_at)")
    .eq("restaurant_id", profile.membership.restaurant_id)
    .order("name");

  if (error) throw new Error(`Unable to load restaurant tables: ${error.message}`);

  return <div className="space-y-6">
    <div><h1 className="font-display text-2xl font-bold">Restaurant tables</h1><p className="text-sm text-muted-foreground">Manage floor capacity, visits, and opaque customer QR codes.</p></div>
    <TableManager tables={data ?? []} />
  </div>;
}
