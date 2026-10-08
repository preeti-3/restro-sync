"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
export async function setRestaurantStatus(restaurantId:string,status:"ACTIVE"|"SUSPENDED"){await requirePlatformAdmin();const parsed=z.object({restaurantId:z.uuid(),status:z.enum(["ACTIVE","SUSPENDED"])}).safeParse({restaurantId,status});if(!parsed.success)return{error:"Invalid restaurant update"};const supabase=await createClient();const{error}=await supabase.rpc("platform_set_restaurant_status",{p_restaurant_id:restaurantId,p_status:status});if(error)return{error:error.message};revalidatePath("/platform");return{ok:true}}
