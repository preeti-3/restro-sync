import { LayoutDashboard, LogOut, ShieldCheck } from "lucide-react";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { logout } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const profile = await requirePlatformAdmin();

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950 text-white">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-600">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="truncate font-display text-sm font-semibold sm:text-base">RestroSync Platform</p>
              <p className="hidden text-xs text-slate-400 sm:block">Platform administration</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <span className="hidden max-w-48 truncate text-sm font-medium text-slate-300 md:inline">{profile.full_name}</span>
            <form action={logout}>
              <Button variant="outline" size="sm" className="border-slate-700 bg-slate-900 px-3 text-white hover:bg-slate-800">
                <LogOut className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Sign out</span>
              </Button>
            </form>
          </div>
        </div>
      </header>
      <div className="border-b bg-white">
        <nav aria-label="Platform navigation" className="mx-auto flex h-12 max-w-[1600px] items-center px-4 sm:px-6 lg:px-8">
          <span className="inline-flex h-12 items-center gap-2 border-b-2 border-primary px-1 text-sm font-semibold text-primary" aria-current="page">
            <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
            Overview
          </span>
        </nav>
      </div>
      <main id="main" className="mx-auto min-w-0 max-w-[1600px] p-4 sm:p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}
