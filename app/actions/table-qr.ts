"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { hashOpaqueToken, newOpaqueToken } from "@/lib/guest/session";
import { getAppUrl } from "@/lib/app-url";
export type QrActionResult={ok?:boolean;error?:string;url?:string};
export async function generateTableQr(tableId:string):Promise<QrActionResult>{await requireRole("OWNER","ADMIN");if(!z.uuid().safeParse(tableId).success)return{error:"Invalid table"};const token=newOpaqueToken();const url=`${getAppUrl()}/order/${token}`;const supabase=await createClient();let {error}=await supabase.rpc("regenerate_table_qr",{p_table_id:tableId,p_token_hash:hashOpaqueToken(token),p_order_url:url});if(error&&(error.message.includes("p_order_url")||error.message.includes("schema cache")||error.code==="PGRST202")){const legacy=await supabase.rpc("regenerate_table_qr",{p_table_id:tableId,p_token_hash:hashOpaqueToken(token)});error=legacy.error;}if(error)return{error:error.message};revalidatePath("/admin/tables");return{ok:true,url};}
export async function deactivateTableQr(tableId:string):Promise<QrActionResult>{const profile=await requireRole("OWNER","ADMIN");if(!z.uuid().safeParse(tableId).success)return{error:"Invalid table"};const supabase=await createClient();const{error}=await supabase.from("table_qr_codes").update({active:false,deactivated_at:new Date().toISOString()}).eq("restaurant_id",profile.membership.restaurant_id).eq("table_id",tableId).eq("active",true);if(error)return{error:error.message};revalidatePath("/admin/tables");return{ok:true};}
