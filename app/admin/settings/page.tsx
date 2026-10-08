import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { Card } from "@/components/ui/primitives";
import { SettingsForm } from "@/components/admin/settings-form";
export default async function SettingsPage(){const p=await requireRole("OWNER","ADMIN");const s=await createClient();const{data}=await s.from("restaurant_settings").select("*").eq("restaurant_id",p.membership.restaurant_id).maybeSingle();return <div className="mx-auto max-w-4xl space-y-6"><div><h1 className="font-display text-2xl font-bold">Restaurant settings</h1><p className="text-sm text-muted-foreground">Business details, billing, UPI, and receipts for this workspace.</p></div><Card className="p-5 sm:p-6"><SettingsForm settings={data??{}}/></Card></div>}
