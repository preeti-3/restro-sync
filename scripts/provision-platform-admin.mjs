import { createClient } from "@supabase/supabase-js";
const url=process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.SUPABASE_SERVICE_ROLE_KEY;const email=process.env.PLATFORM_ADMIN_EMAIL;
if(!url||!key||!email)throw new Error("Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and PLATFORM_ADMIN_EMAIL.");
const admin=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});const{data,error}=await admin.auth.admin.listUsers({page:1,perPage:1000});if(error)throw error;const user=data.users.find(u=>u.email?.toLowerCase()===email.toLowerCase());if(!user)throw new Error("Create and email-confirm the platform administrator in Supabase Auth first. Public registration cannot create this role.");
const{error:profileError}=await admin.from("profiles").upsert({id:user.id,full_name:user.user_metadata?.full_name??"Platform Administrator",role:"ADMIN",active:true},{onConflict:"id"});if(profileError)throw profileError;
const{error:insertError}=await admin.from("platform_admins").upsert({user_id:user.id,active:true},{onConflict:"user_id"});if(insertError)throw insertError;
process.stdout.write(`Provisioned platform administrator: ${email}\n`);
