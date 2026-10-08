import { Ban, LogOut } from "lucide-react";
import { logout } from "@/app/actions/auth";
import { getSessionProfile } from "@/lib/auth/session";
import { Card } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { redirect } from "next/navigation";
export default async function SuspendedPage(){const profile=await getSessionProfile();if(!profile)redirect("/login");if(profile.membership?.restaurant.status==="ACTIVE")redirect("/");return <main className="grid min-h-dvh place-items-center bg-slate-50 p-4"><Card className="max-w-lg p-8 text-center"><Ban className="mx-auto h-12 w-12 text-red-600"/><h1 className="mt-4 font-display text-2xl font-bold">Workspace suspended</h1><p className="mt-2 text-muted-foreground">{profile.membership?.restaurant.name} is temporarily unavailable. Staff and customer ordering are blocked at the server until the platform owner reactivates it.</p><form action={logout} className="mt-6"><Button variant="outline"><LogOut/>Sign out</Button></form></Card></main>}
