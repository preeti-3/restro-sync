import { requireRole } from "@/lib/auth/session";
export default async function KitchenLayout({ children }: { children: React.ReactNode }) { await requireRole("KITCHEN", "ADMIN", "OWNER"); return <main id="main" className="min-h-screen bg-slate-950 text-white">{children}</main> }
