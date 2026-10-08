import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { KitchenBoard } from "@/components/kitchen/kitchen-board";
export default async function KitchenPage(){const p=await requireRole("OWNER","ADMIN","KITCHEN");const s=await createClient();const{data}=await s.from("kot_tickets").select("*,order:orders(order_number,order_type,customer_name,instructions,source,guest_status,estimated_ready_at,created_at,restaurant_tables(name)),kot_items(*)").eq("restaurant_id",p.membership.restaurant_id).order("created_at").limit(100);return <KitchenBoard initialTickets={data??[]} restaurantId={p.membership.restaurant_id}/>}
