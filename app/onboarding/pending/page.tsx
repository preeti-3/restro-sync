import { Clock3, LogOut, Mail } from "lucide-react";
import { logout } from "@/app/actions/auth";
import { getSessionProfile } from "@/lib/auth/session";
import { Card } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { redirect } from "next/navigation";

export default async function PendingPage(){const profile=await getSessionProfile();if(!profile)redirect("/login");if(profile.membership?.restaurant.status==="ACTIVE")redirect("/");return <main className="grid min-h-dvh place-items-center bg-slate-50 p-4"><Card className="w-full max-w-xl p-8 text-center"><span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-amber-100 text-amber-700"><Clock3/></span><p className="mt-5 text-sm font-semibold uppercase tracking-wide text-amber-700">Approval pending</p><h1 className="mt-2 font-display text-3xl font-bold">{profile.membership?.restaurant.name ?? "Your restaurant"} is under review</h1><p className="mx-auto mt-3 max-w-md text-muted-foreground">Your owner account and restaurant were created together. Operations stay locked until a platform administrator approves the restaurant.</p><div className="mt-6 rounded-xl bg-blue-50 p-4 text-left text-sm text-blue-900"><p className="flex items-center gap-2 font-semibold"><Mail className="h-4 w-4"/>What happens next</p><p className="mt-1">After approval, sign in and complete the menu, tables, UPI settings, and staff checklist.</p></div><form action={logout} className="mt-6"><Button variant="outline"><LogOut/>Sign out</Button></form></Card></main>}
