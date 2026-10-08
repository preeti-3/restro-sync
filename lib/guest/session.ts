import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

export const GUEST_COOKIE = "restrosync_guest";
export const hashOpaqueToken = (token: string) => createHash("sha256").update(token).digest("hex");
export const newOpaqueToken = () => randomBytes(32).toString("base64url");

export async function getGuestContext(tableToken: string, requireOpenVisit = false) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(GUEST_COOKIE)?.value;
  if (!sessionToken) return null;
  const admin = createAdminClient();
  const qrHash = hashOpaqueToken(tableToken);
  const sessionHash = hashOpaqueToken(sessionToken);
  const { data: qr } = await admin.from("table_qr_codes").select("id,restaurant_id,table_id,active,restaurant_tables(id,name,active),restaurants(status)").eq("token_hash", qrHash).maybeSingle();
  if (!qr) return null;
  const restaurant=Array.isArray(qr.restaurants)?qr.restaurants[0]:qr.restaurants;
  if (restaurant?.status!=="ACTIVE" || (requireOpenVisit && !qr.active)) return null;
  const { data: session } = await admin.from("guest_sessions").select("id,restaurant_id,table_id,visit_id,expires_at,table_visits(status)").eq("restaurant_id",qr.restaurant_id).eq("session_hash", sessionHash).eq("qr_code_id", qr.id).eq("table_id", qr.table_id).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (!session) return null;
  const visit = Array.isArray(session.table_visits) ? session.table_visits[0] : session.table_visits;
  if (requireOpenVisit && visit?.status !== "OPEN") return null;
  const table = Array.isArray(qr.restaurant_tables) ? qr.restaurant_tables[0] : qr.restaurant_tables;
  return { restaurantId:qr.restaurant_id, sessionId: session.id, visitId: session.visit_id, tableId: session.table_id, tableName: table?.name ?? "Table", visitStatus: visit?.status as "OPEN" | "CLOSED" };
}

export async function getOwnedGuestOrder(tableToken: string, orderId: string) {
  const context = await getGuestContext(tableToken, false);
  if (!context) return null;
  const admin = createAdminClient();
  const { data } = await admin.from("orders").select("id,restaurant_id,order_number,status,guest_status,guest_payment_state,estimated_ready_at,customer_name,instructions,subtotal_paise,discount_paise,tax_paise,service_charge_paise,total_paise,created_at,table_id,restaurant_tables(name),order_items(id,item_name,quantity,variant_name,notes,line_total_paise,order_item_addons(addon_name,price_paise)),guest_payment_claims(id,status,transaction_reference,rejection_reason,created_at)").eq("restaurant_id",context.restaurantId).eq("id", orderId).eq("guest_session_id", context.sessionId).maybeSingle();
  return data ? { context, order: data } : null;
}
