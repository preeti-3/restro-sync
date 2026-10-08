import { requireRole } from "@/lib/auth/session";
import { AppHeader } from "@/components/shared/app-header";
export default async function CashierLayout({ children }: { children: React.ReactNode }) { const profile = await requireRole("CASHIER", "ADMIN", "OWNER"); return <div className="min-h-screen"><AppHeader profile={profile} title="Point of sale"/><main id="main">{children}</main></div> }
