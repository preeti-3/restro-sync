import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { TableManager } from "@/components/admin/table-manager";
export default async function TablesPage(){const p=await requireRole("OWNER","ADMIN");const s=await createClient();const{data}=await s.from("restaurant_tables").select("*,table_qr_codes(id,active,created_at),table_visits(id,status,started_at)").eq("restaurant_id",p.membership.restaurant_id).order("name");return <div className="space-y-6"><div><h1 className="font-display text-2xl font-bold">Restaurant tables</h1><p className="text-sm text-muted-foreground">Manage floor capacity, visits, and opaque customer QR codes.</p></div><TableManager tables={data??[]}/></div>}
