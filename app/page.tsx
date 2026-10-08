import { redirect } from "next/navigation";
import { getSessionProfile, roleHome } from "@/lib/auth/session";
export default async function Home() { const profile = await getSessionProfile(); if(!profile)redirect("/login");if(profile.is_platform_admin)redirect("/platform");if(!profile.membership)redirect("/login");if(profile.membership.restaurant.status==="PENDING")redirect("/onboarding/pending");if(profile.membership.restaurant.status==="SUSPENDED")redirect("/workspace/suspended");redirect(roleHome(profile.membership.role)); }
