"use server";
import { createHash,randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { invitationSchema } from "@/lib/validations";
const hash=(value:string)=>createHash("sha256").update(value).digest("hex");
export async function inviteStaff(_: {error?:string;url?:string;ok?:boolean},formData:FormData){const profile=await requireRole("OWNER");const parsed=invitationSchema.safeParse(Object.fromEntries(formData));if(!parsed.success)return{error:parsed.error.issues[0]?.message};const token=randomBytes(32).toString("base64url");const admin=createAdminClient();const{error}=await admin.from("staff_invitations").insert({restaurant_id:profile.membership.restaurant_id,email:parsed.data.email.toLowerCase(),role:parsed.data.role,token_hash:hash(token),invited_by:profile.id,expires_at:new Date(Date.now()+7*86400000).toISOString()});if(error)return{error:error.message};const base=(process.env.NEXT_PUBLIC_APP_URL??"http://localhost:3000").replace(/\/$/,"");await admin.auth.admin.inviteUserByEmail(parsed.data.email,{redirectTo:`${base}/invite/${token}`,data:{restaurant_invitation:true}});revalidatePath("/admin/staff");return{ok:true,url:`${base}/invite/${token}`}}
export async function updateMemberAccess(memberId:string,role:"ADMIN"|"CASHIER"|"KITCHEN"|"REMOVE"){const profile=await requireRole("OWNER");const parsed=z.object({memberId:z.uuid(),role:z.enum(["ADMIN","CASHIER","KITCHEN","REMOVE"])}).safeParse({memberId,role});if(!parsed.success)return{error:"Invalid staff update"};const supabase=await createClient();const query=supabase.from("restaurant_members").update(role==="REMOVE"?{active:false}:{role}).eq("id",memberId).eq("restaurant_id",profile.membership.restaurant_id).neq("role","OWNER");const{error}=await query;if(error)return{error:error.message};revalidatePath("/admin/staff");return{ok:true}}
export async function acceptInvitation(token:string){const parsed=z.string().min(32).max(200).safeParse(token);if(!parsed.success)return{error:"Invalid invitation"};const supabase=await createClient();const{error}=await supabase.rpc("accept_staff_invitation",{p_token_hash:hash(token)});if(error)return{error:error.message};return{ok:true}}
