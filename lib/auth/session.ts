import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import type { RestaurantMembership, RestaurantRole, SessionProfile } from "@/types";

export const WORKSPACE_COOKIE = "restrosync_workspace";

export const getSessionProfile = cache(async (): Promise<SessionProfile | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) return null;
  const [{ data: profile }, { data: rows }, { data: platformAdmin }] = await Promise.all([
    supabase.from("profiles").select("id,full_name,role,active,created_at").eq("id", userId).single(),
    supabase.from("restaurant_members").select("id,restaurant_id,user_id,role,active,restaurant:restaurants(id,name,address,phone,email,status,created_at,approved_at)").eq("user_id", userId).eq("active", true),
    supabase.from("platform_admins").select("user_id").eq("user_id", userId).eq("active", true).maybeSingle(),
  ]);
  if (!profile?.active) return null;
  const memberships = (rows ?? [])
    .map((row) => ({ ...row, restaurant: Array.isArray(row.restaurant) ? row.restaurant[0] : row.restaurant }))
    .filter((row) => Boolean(row.restaurant)) as RestaurantMembership[];
  if (!memberships.length) return platformAdmin ? ({ ...profile, membership: null, memberships, is_platform_admin: true } as unknown as SessionProfile) : null;
  const preferred = (await cookies()).get(WORKSPACE_COOKIE)?.value;
  const membership = memberships.find((item) => item.restaurant_id === preferred) ?? memberships[0];
  return { ...profile, role: membership.role, membership, memberships, is_platform_admin: Boolean(platformAdmin) } as unknown as SessionProfile;
});

export async function requireRole(...roles: RestaurantRole[]) {
  const profile = await getSessionProfile();
  if (!profile?.active) redirect("/login");
  if (!profile.membership?.restaurant) redirect(profile.is_platform_admin ? "/platform" : "/login");
  if (profile.membership.restaurant.status === "PENDING") redirect("/onboarding/pending");
  if (profile.membership.restaurant.status === "SUSPENDED") redirect("/workspace/suspended");
  if (!roles.includes(profile.membership.role)) redirect(roleHome(profile.membership.role));
  return profile;
}

export async function requirePlatformAdmin() {
  const profile = await getSessionProfile();
  if (!profile?.is_platform_admin) redirect("/");
  return profile;
}

export const roleHome = (role: RestaurantRole) => role === "OWNER" ? "/admin" : `/${role.toLowerCase()}`;
