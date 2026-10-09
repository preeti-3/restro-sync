"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { BarChart3, ChevronRight, ClipboardList, LayoutDashboard, MoreHorizontal, Settings, Sparkles, Table2, Users, UtensilsCrossed } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brand } from "@/components/shared/app-header";
import { cn } from "@/lib/utils";

const links = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/menu", label: "Menu", icon: UtensilsCrossed },
  { href: "/admin/tables", label: "Tables", icon: Table2 },
  { href: "/admin/staff", label: "Staff", icon: Users },
  { href: "/admin/orders", label: "Orders", icon: ClipboardList },
  { href: "/admin/reports", label: "Reports", icon: BarChart3 },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

const mobileLinks = links.filter(({ href }) => ["/admin", "/admin/menu", "/admin/orders", "/admin/reports"].includes(href));
const moreLinks = links.filter(({ href }) => ["/admin/tables", "/admin/staff", "/admin/settings"].includes(href));

function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === href : pathname.startsWith(href);
}

export function AdminSidebar() {
  const pathname = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden h-dvh w-72 flex-col overflow-hidden border-r border-white/5 bg-[#173b31] text-emerald-50 shadow-[12px_0_40px_rgba(23,59,49,0.12)] lg:flex">
      <Brand />
      <div className="px-5 pb-2 pt-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-200/50">Workspace</p>
      </div>
      <nav aria-label="Admin navigation" className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        {links.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link key={href} href={href} prefetch={false} aria-current={active ? "page" : undefined} className={cn("group flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-all duration-200", active ? "bg-orange-600 text-white shadow-[0_8px_22px_rgba(234,88,12,0.28)]" : "text-emerald-100/65 hover:bg-white/[0.08] hover:text-white")}>
              <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors", active ? "bg-white/15" : "bg-white/[0.04] group-hover:bg-white/[0.08]")}>
                <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
              </span>
              <span className="flex-1">{label}</span>
              {active && <ChevronRight className="h-4 w-4 text-orange-100" aria-hidden="true" />}
            </Link>
          );
        })}
      </nav>
      <div className="m-3 rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-emerald-50">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-orange-500/20 text-orange-200"><Sparkles className="h-4 w-4" aria-hidden="true" /></span>
          RestroSync workspace
        </div>
        <p className="text-xs leading-5 text-emerald-100/50">Restaurant operations, organized in one place.</p>
      </div>
    </aside>
  );
}

export function AdminMobileNav() {
  const pathname = usePathname();
  const moreActive = moreLinks.some(({ href }) => isActive(pathname, href));
  return (
    <nav aria-label="Admin mobile navigation" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-orange-100 bg-[#fffdfa]/95 px-1 pb-[max(.25rem,env(safe-area-inset-bottom))] pt-1 shadow-[0_-8px_24px_rgba(67,35,18,0.08)] backdrop-blur lg:hidden">
      {mobileLinks.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link key={href} href={href} prefetch={false} aria-current={active ? "page" : undefined} className={cn("flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[10px] font-semibold transition-colors", active ? "bg-orange-50 text-primary" : "text-muted-foreground")}>
            <Icon className="h-5 w-5" aria-hidden="true" />
            <span className="truncate">{label}</span>
          </Link>
        );
      })}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button type="button" aria-label="More navigation options" className={cn("flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[10px] font-semibold transition-colors", moreActive ? "bg-orange-50 text-primary" : "text-muted-foreground")}>
            <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
            More
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content side="top" align="end" sideOffset={10} className="z-50 min-w-48 rounded-xl border bg-white p-1.5 shadow-xl">
            {moreLinks.map(({ href, label, icon: Icon }) => (
              <DropdownMenu.Item key={href} asChild>
                <Link href={href} prefetch={false} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 text-sm font-semibold outline-none transition-colors focus:bg-muted">
                  <Icon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                  {label}
                </Link>
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </nav>
  );
}
