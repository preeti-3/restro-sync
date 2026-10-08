import Link from "next/link";
import { ChefHat, ShieldCheck } from "lucide-react";
import { RegisterForm } from "@/components/auth/register-form";
import { Card } from "@/components/ui/primitives";

export default function RegisterPage(){return <main className="min-h-dvh bg-slate-50 px-4 py-10 sm:py-16"><div className="mx-auto max-w-2xl"><div className="mb-8 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-primary text-white"><ChefHat/></span><h1 className="mt-4 font-display text-3xl font-bold">Register your restaurant</h1><p className="mt-2 text-muted-foreground">Create your owner account and submit one outlet for platform approval.</p></div><Card className="p-5 sm:p-8"><RegisterForm/></Card><div className="mt-5 flex items-center justify-between text-sm"><Link className="font-semibold text-primary hover:underline" href="/login">Already registered? Sign in</Link><span className="flex items-center gap-1 text-muted-foreground"><ShieldCheck className="h-4 w-4"/>Secure tenant setup</span></div></div></main>}
