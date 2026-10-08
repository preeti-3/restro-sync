"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loginSchema } from "@/lib/validations";
import { roleHome } from "@/lib/auth/session";
import { registrationSchema } from "@/lib/validations";

export type AuthState = { error?: string };
export async function login(_: AuthState, formData: FormData): Promise<AuthState> {
  const next=String(formData.get("next")??"");
  const inviteNext=/^\/invite\/[A-Za-z0-9_-]{32,200}$/.test(next)?next:null;
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Enter a valid email and a password of at least 8 characters." };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) return { error: "Email or password is incorrect." };
  if(inviteNext)redirect(inviteNext);
  const { data: membership } = await supabase.from("restaurant_members").select("role,restaurants(status)").eq("user_id", data.user.id).eq("active",true).limit(1).maybeSingle();
  const { data: platform } = await supabase.from("platform_admins").select("user_id").eq("user_id",data.user.id).eq("active",true).maybeSingle();
  if (platform) redirect("/platform");
  if (!membership) { await supabase.auth.signOut(); return { error: "This account has no active restaurant access." }; }
  const restaurant = Array.isArray(membership.restaurants) ? membership.restaurants[0] : membership.restaurants;
  if (restaurant?.status === "PENDING") redirect("/onboarding/pending");
  if (restaurant?.status === "SUSPENDED") redirect("/workspace/suspended");
  redirect(roleHome(membership.role));
}
export async function logout() { const supabase = await createClient(); await supabase.auth.signOut(); redirect("/login"); }

export async function registerRestaurant(_: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = registrationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check your registration details." };
  const supabase = await createClient();
  const { ownerName, restaurantName, address, phone, email, password } = parsed.data;
  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { registration_type: "restaurant_owner", owner_name: ownerName, restaurant_name: restaurantName, restaurant_address: address, restaurant_phone: phone } } });
  if (error) return { error: error.message };
  if (!data.session) return { error: "Check your email to confirm the account, then sign in to view approval status." };
  redirect("/onboarding/pending");
}
