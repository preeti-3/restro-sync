import { redirect } from "next/navigation";
import { ChefHat, ShieldCheck, Zap } from "lucide-react";
import { getSessionProfile, roleHome } from "@/lib/auth/session";
import { LoginForm } from "@/components/auth/login-form";
import Link from "next/link";

export default async function LoginPage({searchParams}:{searchParams:Promise<{next?:string;error?:string}>}) {
  const {next,error}=await searchParams;
  const profile = await getSessionProfile();
  if (profile?.is_platform_admin) redirect("/platform");
  if (profile?.membership) redirect(roleHome(profile.membership.role));
  return (
    <main id="main" className="grid min-h-screen lg:grid-cols-2">
      <section className="hidden bg-[#173b31] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-orange-600 shadow-lg shadow-orange-950/20">
            <ChefHat />
          </span> 
          <span className="font-display text-xl font-semibold">RestroSync</span>
        </div>
        <div className="max-w-lg">
          <p className="mb-4 text-sm font-bold uppercase tracking-[.2em] text-orange-300">
            Restaurant operations
          </p>
          <h1 className="font-display text-5xl font-bold leading-tight">
            Every order. Every station. Perfectly in sync.
          </h1>
          <p className="mt-5 text-lg leading-8 text-emerald-50/75">
            One secure workspace for your floor, counter, kitchen, and business
            insights.
          </p>
        </div>
        <div className="flex gap-8 text-sm text-emerald-50/75">
          <span className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-orange-400" />
            Live kitchen updates
          </span>
          <span className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-orange-400" />
            Role-secured access
          </span>
        </div>
      </section>
      <section className="flex items-center justify-center bg-[#fbf7f1] p-6">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-3 font-display text-xl font-semibold">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-white">
                <ChefHat />
              </span>
              RestroSync
            </div>
          </div>
          <p className="text-sm font-semibold text-primary">Welcome back</p>
          <h2 className="mt-2 font-display text-3xl font-bold">
            Sign in to your workspace
          </h2>
          <p className="mb-8 mt-2 text-muted-foreground">
            Use the account created by your restaurant administrator.
          </p>
          {error && <p role="alert" className="mb-5 rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700">{error}</p>}
          <LoginForm next={next} />
          <p className="mt-6 text-center text-sm text-muted-foreground">Opening a new outlet? <Link href="/register" className="font-semibold text-primary hover:underline">Register your restaurant</Link></p>
        </div>
      </section>
    </main>
  );
}
