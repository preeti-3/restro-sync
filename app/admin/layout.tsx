import { requireRole } from "@/lib/auth/session";
import { AdminMobileNav, AdminSidebar } from "@/components/admin/sidebar";
import { AppHeader } from "@/components/shared/app-header";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireRole("OWNER", "ADMIN");

  return (
    <div className="min-h-dvh bg-background lg:h-dvh lg:overflow-hidden">
      <AdminSidebar />
      <div className="min-w-0 lg:h-dvh lg:overflow-y-auto lg:pl-72">
        <AppHeader profile={profile} title="Admin console" />
        <main id="main" className="mx-auto min-w-0 max-w-[1600px] p-4 pb-24 sm:p-6 lg:p-8 lg:pb-10 xl:px-10">
          {children}
        </main>
      </div>
      <AdminMobileNav />
    </div>
  );
}
