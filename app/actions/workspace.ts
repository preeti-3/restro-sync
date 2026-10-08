"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { WORKSPACE_COOKIE } from "@/lib/auth/session";

export async function switchWorkspace(formData: FormData){const parsed=z.uuid().safeParse(formData.get("restaurantId"));if(!parsed.success)redirect("/");const supabase=await createClient();const{data}=await supabase.from("restaurant_members").select("restaurant_id,role,restaurants(status)").eq("restaurant_id",parsed.data).eq("active",true).maybeSingle();if(!data)redirect("/");(await cookies()).set(WORKSPACE_COOKIE,data.restaurant_id,{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",path:"/",maxAge:60*60*24*365});const restaurant=Array.isArray(data.restaurants)?data.restaurants[0]:data.restaurants;if(restaurant?.status==="PENDING")redirect("/onboarding/pending");if(restaurant?.status==="SUSPENDED")redirect("/workspace/suspended");redirect(data.role==="OWNER"?"/admin":`/${data.role.toLowerCase()}`)}
