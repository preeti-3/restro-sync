"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import {
  CakeSlice,
  Check,
  ChefHat,
  CircleDot,
  Coffee,
  CookingPot,
  CupSoda,
  Drumstick,
  Home,
  IceCreamBowl,
  Minus,
  Pizza,
  Plus,
  ReceiptText,
  Salad,
  Sandwich,
  Search,
  ShoppingBag,
  Soup,
  UtensilsCrossed,
  X,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { submitGuestOrder } from "@/app/actions/guest";
import { Button } from "@/components/ui/button";
import { Badge, Card, EmptyState, Input, Label, Textarea } from "@/components/ui/primitives";
import { formatMoney } from "@/lib/utils";
import type { Category, MenuItem } from "@/types";

type CartLine = {
  key: string;
  item: MenuItem;
  quantity: number;
  variantId: string | null;
  variantName: string | null;
  variantDelta: number;
  addonIds: string[];
  addonNames: string[];
  addonTotal: number;
  notes: string;
};

type NavSection = "home" | "search" | "orders" | "cart";
type FoodFilter = "ALL" | "VEG" | "NON_VEG";

function categoryIconForFood(label: string): LucideIcon | null {
  const value = label.toLowerCase();
  if (value.includes("main") || value.includes("course") || value.includes("thali") || value.includes("biryani") || value.includes("rice") || value.includes("curry")) return CookingPot;
  if (value.includes("starter") || value.includes("appetizer") || value.includes("salad")) return Salad;
  if (value.includes("drink") || value.includes("beverage") || value.includes("juice") || value.includes("shake")) return CupSoda;
  if (value.includes("coffee") || value.includes("tea")) return Coffee;
  if (value.includes("dessert") || value.includes("sweet") || value.includes("ice cream")) return IceCreamBowl;
  if (value.includes("cake") || value.includes("bakery")) return CakeSlice;
  if (value.includes("pizza")) return Pizza;
  if (value.includes("burger") || value.includes("sandwich")) return Sandwich;
  if (value.includes("soup") || value.includes("noodle")) return Soup;
  if (value.includes("chicken") || value.includes("non-veg") || value.includes("meat")) return Drumstick;
  if (value.includes("combo") || value.includes("special")) return UtensilsCrossed;
  return null;
}

export function CustomerMenu({
  tableToken,
  restaurantName,
  tableName,
  categories,
  items,
  previousOrders,
}: {
  tableToken: string;
  restaurantName: string;
  tableName: string;
  categories: Category[];
  items: MenuItem[];
  previousOrders: { id: string; order_number: string; guest_status: string | null; created_at: string }[];
}) {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);
  const [submissionKey] = useState(() => crypto.randomUUID());
  const [category, setCategory] = useState("ALL");
  const [foodFilter, setFoodFilter] = useState<FoodFilter>("ALL");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [name, setName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [configuring, setConfiguring] = useState<MenuItem | null>(null);
  const [variantId, setVariantId] = useState<string | null>(null);
  const [addonIds, setAddonIds] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [navSection, setNavSection] = useState<NavSection>("home");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const filtered = items.filter(
    (item) =>
      (category === "ALL" || item.category_id === category) &&
      (foodFilter === "ALL" || item.food_type === foodFilter) &&
      `${item.name} ${item.description ?? ""}`.toLowerCase().includes(search.toLowerCase()),
  );
  const subtotal = useMemo(
    () => cart.reduce((sum, line) => sum + (line.item.price_paise + line.variantDelta + line.addonTotal) * line.quantity, 0),
    [cart],
  );
  const count = cart.reduce((sum, line) => sum + line.quantity, 0);

  function scrollTo(id: string, section: NavSection) {
    setNavSection(section);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function focusSearch() {
    scrollTo("menu-search", "search");
    window.setTimeout(() => searchRef.current?.focus(), 300);
  }

  function openItem(item: MenuItem) {
    if (!item.available) return;
    setConfiguring(item);
    setVariantId(item.menu_variants?.[0]?.id ?? null);
    setAddonIds([]);
    setNotes("");
  }

  function add() {
    if (!configuring) return;
    const variant = configuring.menu_variants?.find((item) => item.id === variantId);
    const addons = configuring.addons?.filter((item) => addonIds.includes(item.id)) ?? [];
    const key = `${configuring.id}:${variantId ?? ""}:${[...addonIds].sort().join("-")}:${notes}`;
    setCart((current) => {
      const found = current.find((line) => line.key === key);
      return found
        ? current.map((line) => (line.key === key ? { ...line, quantity: line.quantity + 1 } : line))
        : [
            ...current,
            {
              key,
              item: configuring,
              quantity: 1,
              variantId,
              variantName: variant?.name ?? null,
              variantDelta: variant?.price_delta_paise ?? 0,
              addonIds,
              addonNames: addons.map((item) => item.name),
              addonTotal: addons.reduce((sum, item) => sum + item.price_paise, 0),
              notes,
            },
          ];
    });
    setConfiguring(null);
  }

  function quantity(key: string, delta: number) {
    setCart((current) =>
      current
        .map((line) => (line.key === key ? { ...line, quantity: line.quantity + delta } : line))
        .filter((line) => line.quantity > 0),
    );
  }

  function openCart() {
    if (!count) return;
    setNavSection("cart");
    setCartOpen(true);
  }

  function submit() {
    setError("");
    if (!name.trim()) {
      setError("Enter your name or nickname so staff can identify your order.");
      return;
    }
    startTransition(async () => {
      const result = await submitGuestOrder({
        tableToken,
        submissionKey,
        customerName: name,
        instructions,
        items: cart.map((line) => ({
          menuItemId: line.item.id,
          quantity: line.quantity,
          variantId: line.variantId,
          addonIds: line.addonIds,
          notes: line.notes,
        })),
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push(`/order/${tableToken}/orders/${result.orderId}`);
    });
  }

  return (
    <div className="min-h-dvh bg-[#fbf7f1] pb-28 text-slate-950 lg:pb-12">
      <header className="sticky top-0 z-30 border-b border-orange-100 bg-[#fbf7f1]/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <button type="button" onClick={() => scrollTo("customer-home", "home")} className="flex min-w-0 items-center gap-3 rounded-xl text-left">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-orange-600 text-white shadow-sm">
              <ChefHat className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold">{restaurantName}</span>
              <span className="flex items-center gap-1 text-xs text-slate-500"><CircleDot className="h-3 w-3 text-orange-600" /> Ordering at {tableName}</span>
            </span>
          </button>
          <button type="button" onClick={focusSearch} aria-label="Search menu" className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-orange-100 bg-white text-slate-700 shadow-sm transition-colors hover:border-orange-300 hover:text-orange-700">
            <Search className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-5xl px-4 py-4 sm:px-6 sm:py-6">
        <section id="customer-home" className="relative min-h-56 scroll-mt-20 overflow-hidden rounded-[2rem] bg-[#310706] bg-[url('/images/menu-hero-food.png')] bg-cover bg-[72%_center] px-5 py-7 text-white shadow-[0_18px_50px_rgba(49,7,6,0.24)] sm:min-h-64 sm:bg-center sm:px-8 sm:py-9">
          <div className="absolute inset-0 bg-gradient-to-r from-[#210303] via-[#310706]/95 to-transparent sm:via-[#310706]/75" aria-hidden="true" />
          <div className="relative z-10 max-w-[58%] sm:max-w-md">
            <h1 className="font-display text-2xl font-bold leading-tight tracking-tight sm:text-4xl">Good food, made for your table.</h1>
            <p className="mt-3 text-xs leading-5 text-orange-50/85 sm:text-base sm:leading-6">Browse the menu, customize your dishes, and send your order directly to the kitchen.</p>
          </div>
        </section>

        {previousOrders.length > 0 && (
          <section id="previous-orders" className="scroll-mt-20 pt-7">
            <div className="mb-3 flex items-end justify-between">
              <div><p className="text-xs font-bold uppercase tracking-wider text-orange-600">Your visit</p><h2 className="font-display text-xl font-bold">Recent orders</h2></div>
              <ReceiptText className="h-5 w-5 text-slate-400" />
            </div>
            <div className="flex snap-x gap-3 overflow-x-auto pb-2">
              {previousOrders.map((order) => (
                <button key={order.id} onClick={() => router.push(`/order/${tableToken}/orders/${order.id}`)} className="min-h-20 min-w-48 snap-start rounded-2xl border border-orange-100 bg-white p-4 text-left shadow-sm transition-colors hover:border-orange-300">
                  <span className="block text-sm font-bold">{order.order_number}</span>
                  <span className="mt-1 inline-flex rounded-full bg-orange-50 px-2 py-1 text-xs font-semibold text-orange-700">{order.guest_status ?? "PLACED"}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        <section id="menu" className="scroll-mt-20 pt-7">
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-wider text-orange-600">Discover</p>
            <h2 className="font-display text-2xl font-bold tracking-tight">What are you craving?</h2>
          </div>

          <div id="menu-search" className="relative scroll-mt-24">
            <Search className="pointer-events-none absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
            <Input ref={searchRef} className="h-12 rounded-2xl border-orange-100 bg-white pl-11 pr-4 text-base shadow-sm focus:border-orange-400 focus:ring-orange-500" value={search} onFocus={() => setNavSection("search")} onChange={(event) => setSearch(event.target.value)} placeholder="Search dishes or ingredients" aria-label="Search menu" />
          </div>

          <div className="mt-5 flex gap-3 overflow-x-auto pb-2" aria-label="Menu categories">
            <button onClick={() => setCategory("ALL")} aria-pressed={category === "ALL"} className={`flex min-w-[76px] shrink-0 flex-col items-center gap-2 rounded-2xl border p-3 text-xs font-bold transition-colors ${category === "ALL" ? "border-orange-500 bg-orange-500 text-white shadow-md shadow-orange-200" : "border-orange-100 bg-white text-slate-700"}`}>
              <CategoryTabIcon label="All dishes" active={category === "ALL"} />
              All
            </button>
            {categories.map((item) => {
              const active = category === item.id;
              return (
                <button key={item.id} onClick={() => setCategory(item.id)} aria-pressed={active} className={`flex min-w-[84px] shrink-0 flex-col items-center gap-2 rounded-2xl border p-3 text-xs font-bold transition-colors ${active ? "border-orange-500 bg-orange-500 text-white shadow-md shadow-orange-200" : "border-orange-100 bg-white text-slate-700 hover:border-orange-300"}`}>
                  <CategoryTabIcon label={item.name} active={active} />
                  <span className="max-w-16 truncate">{item.name}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-6 flex items-center justify-between">
            <h2 className="font-display text-xl font-bold">Popular on the menu</h2>
            <span className="text-sm font-semibold text-slate-500">{filtered.length} dishes</span>
          </div>

          <div className="mt-3 flex gap-2" role="group" aria-label="Filter menu by dietary preference">
            {(["ALL", "VEG", "NON_VEG"] as FoodFilter[]).map((filter) => {
              const active = foodFilter === filter;
              return (
                <button key={filter} type="button" onClick={() => setFoodFilter(filter)} aria-pressed={active} className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-bold transition-colors ${active ? "border-slate-900 bg-slate-900 text-white" : "border-orange-100 bg-white text-slate-700 hover:border-orange-300"}`}>
                  {filter !== "ALL" && <FoodTypeSymbol type={filter} />}
                  {filter === "ALL" ? "All" : filter === "VEG" ? "Veg" : "Non-veg"}
                </button>
              );
            })}
          </div>

          <section className="mt-3 grid gap-2 md:grid-cols-2">
            {filtered.length ? (
              filtered.map((item) => {
                const categoryName = categories.find((entry) => entry.id === item.category_id)?.name ?? "Dish";
                return (
                  <button key={item.id} onClick={() => openItem(item)} disabled={!item.available} className="group flex min-h-24 w-full items-stretch overflow-hidden rounded-2xl border border-orange-100 bg-white text-left shadow-sm transition-all duration-200 hover:border-orange-300 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60">
                    <span className="relative grid w-20 shrink-0 place-items-center bg-orange-50 text-orange-600">
                      <FoodPlateIcon label={`${categoryName}: ${item.name}`} />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col px-3 py-2.5">
                      <span className="flex items-start justify-between gap-2">
                        <span className="min-w-0"><span className="block truncate font-display text-base font-bold">{item.name}</span></span>
                        {!item.available && <Badge>Unavailable</Badge>}
                      </span>
                      <span className="mt-0.5 line-clamp-1 text-xs leading-4 text-slate-500">{item.description || categoryName}</span>
                      <span className="mt-auto flex items-center justify-between pt-1.5">
                        <span className="font-display text-sm font-bold text-orange-700 tabular-nums">{formatMoney(item.price_paise)}</span>
                        <span className="flex items-center gap-2">
                          <FoodTypeSymbol type={item.food_type} />
                          <span className="grid h-8 w-8 place-items-center rounded-full bg-orange-500 text-white shadow-sm"><Plus className="h-4 w-4" /></span>
                        </span>
                      </span>
                    </span>
                  </button>
                );
              })
            ) : (
              <div className="md:col-span-2"><EmptyState icon={Search} title="No dishes found" description="Try a different category or search." /></div>
            )}
          </section>
        </section>
      </main>

      {count > 0 && (
        <div className="fixed inset-x-0 bottom-4 z-30 hidden px-4 lg:block">
          <Button className="mx-auto flex w-full max-w-xl justify-between rounded-2xl bg-orange-600 shadow-xl shadow-orange-950/20 hover:bg-orange-700" size="lg" onClick={openCart}>
            <span className="rounded-full bg-white/15 px-2.5 py-1">{count} {count === 1 ? "item" : "items"}</span>
            <span>View order · {formatMoney(subtotal)}</span>
          </Button>
        </div>
      )}

      <nav aria-label="Customer ordering navigation" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-orange-100 bg-white/95 px-2 pb-[max(.35rem,env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-12px_35px_rgba(67,35,18,0.10)] backdrop-blur lg:hidden">
        <BottomNavButton label="Browse" icon={Home} active={navSection === "home"} onClick={() => scrollTo("customer-home", "home")} />
        <BottomNavButton label="Search" icon={Search} active={navSection === "search"} onClick={focusSearch} />
        <BottomNavButton label="Orders" icon={ReceiptText} active={navSection === "orders"} disabled={!previousOrders.length} onClick={() => scrollTo("previous-orders", "orders")} />
        <BottomNavButton label="Cart" icon={ShoppingBag} active={navSection === "cart"} disabled={!count} badge={count || undefined} onClick={openCart} />
      </nav>

      {configuring && (
        <div className="fixed inset-0 z-50 flex items-end bg-slate-950/60 sm:items-center sm:justify-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="item-title">
          <Card className="max-h-[92dvh] w-full overflow-y-auto rounded-b-none rounded-t-[2rem] border-orange-100 bg-[#fffdfa] p-5 sm:max-w-md sm:rounded-[2rem] sm:p-6">
            <div className="flex justify-between gap-4">
              <div><p className="text-sm font-bold text-orange-600">Customize your dish</p><h2 id="item-title" className="mt-1 font-display text-2xl font-bold">{configuring.name}</h2></div>
              <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setConfiguring(null)} aria-label="Close"><X /></Button>
            </div>
            {configuring.menu_variants?.length ? (
              <fieldset className="mt-5"><legend className="mb-2 font-bold">Choose a size</legend>{configuring.menu_variants.map((variant) => <label key={variant.id} className="mb-2 flex min-h-12 cursor-pointer items-center justify-between rounded-xl border border-orange-100 bg-white p-3 transition-colors has-[:checked]:border-orange-500 has-[:checked]:bg-orange-50"><span><input type="radio" name="variant" checked={variantId === variant.id} onChange={() => setVariantId(variant.id)} className="mr-3 text-orange-600 focus:ring-orange-500" />{variant.name}</span><span className="font-semibold">+{formatMoney(variant.price_delta_paise)}</span></label>)}</fieldset>
            ) : null}
            {configuring.addons?.length ? (
              <fieldset className="mt-5"><legend className="mb-2 font-bold">Add extras</legend>{configuring.addons.map((addon) => <label key={addon.id} className="mb-2 flex min-h-12 cursor-pointer items-center justify-between rounded-xl border border-orange-100 bg-white p-3 transition-colors has-[:checked]:border-orange-500 has-[:checked]:bg-orange-50"><span><input type="checkbox" checked={addonIds.includes(addon.id)} onChange={() => setAddonIds((ids) => ids.includes(addon.id) ? ids.filter((id) => id !== addon.id) : [...ids, addon.id])} className="mr-3 rounded text-orange-600 focus:ring-orange-500" />{addon.name}</span><span className="font-semibold">+{formatMoney(addon.price_paise)}</span></label>)}</fieldset>
            ) : null}
            <div className="mt-5"><Label htmlFor="item-notes">Special instructions</Label><Textarea id="item-notes" className="border-orange-100 bg-white text-base focus:border-orange-400 focus:ring-orange-500" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Less spicy, no onion…" /></div>
            <Button className="mt-5 w-full rounded-xl bg-orange-600 hover:bg-orange-700" size="lg" onClick={add}><Check />Add to order</Button>
          </Card>
        </div>
      )}

      {cartOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-slate-950/60 sm:items-center sm:justify-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="cart-title">
          <Card className="max-h-[94dvh] w-full overflow-y-auto rounded-b-none rounded-t-[2rem] border-orange-100 bg-[#fffdfa] p-5 sm:max-w-lg sm:rounded-[2rem] sm:p-6">
            <div className="flex justify-between gap-4">
              <div><p className="text-sm font-bold text-orange-600">{tableName}</p><h2 id="cart-title" className="mt-1 font-display text-2xl font-bold">Review your order</h2></div>
              <Button variant="ghost" size="icon" className="rounded-full" onClick={() => { setCartOpen(false); setNavSection("home"); }} aria-label="Close"><X /></Button>
            </div>
            <div className="my-5 divide-y divide-orange-100">
              {cart.map((line) => (
                <div key={line.key} className="py-4">
                  <div className="flex justify-between gap-3"><div className="min-w-0"><p className="font-bold">{line.item.name}</p><p className="text-sm text-slate-500">{[line.variantName, ...line.addonNames].filter(Boolean).join(" · ") || "Standard"}</p>{line.notes && <p className="mt-1 text-sm text-amber-700">{line.notes}</p>}</div><p className="shrink-0 font-bold tabular-nums">{formatMoney((line.item.price_paise + line.variantDelta + line.addonTotal) * line.quantity)}</p></div>
                  <div className="mt-3 flex items-center gap-2"><Button size="icon" variant="outline" className="rounded-full border-orange-200" onClick={() => quantity(line.key, -1)} aria-label={`Reduce ${line.item.name}`}><Minus /></Button><span className="w-8 text-center font-bold tabular-nums">{line.quantity}</span><Button size="icon" variant="outline" className="rounded-full border-orange-200" onClick={() => quantity(line.key, 1)} aria-label={`Add ${line.item.name}`}><Plus /></Button></div>
                </div>
              ))}
            </div>
            <div><Label htmlFor="guest-name">Your name or nickname *</Label><Input id="guest-name" className="border-orange-100 bg-white text-base focus:border-orange-400 focus:ring-orange-500" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" placeholder="e.g. Asha" /></div>
            <div className="mt-4"><Label htmlFor="order-notes">Instructions for the whole order</Label><Textarea id="order-notes" className="border-orange-100 bg-white text-base focus:border-orange-400 focus:ring-orange-500" value={instructions} onChange={(event) => setInstructions(event.target.value)} placeholder="Anything staff should know?" /></div>
            {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
            <div className="mt-5 flex items-center justify-between border-t border-orange-100 pt-4"><span className="font-semibold">Estimated subtotal</span><span className="font-display text-xl font-bold tabular-nums">{formatMoney(subtotal)}</span></div>
            <p className="mt-1 text-xs text-slate-500">Tax and service charge are calculated securely at checkout.</p>
            <Button className="mt-5 w-full rounded-xl bg-orange-600 hover:bg-orange-700" size="lg" onClick={submit} disabled={pending || !cart.length}>{pending ? <ChefHat className="animate-pulse" /> : <ShoppingBag />}{pending ? "Placing order…" : "Place order"}</Button>
          </Card>
        </div>
      )}
    </div>
  );
}

function FoodTypeSymbol({ type }: { type: "VEG" | "NON_VEG" }) {
  const vegetarian = type === "VEG";
  return (
    <span role="img" aria-label={vegetarian ? "Vegetarian" : "Non-vegetarian"} className={`grid h-4 w-4 shrink-0 place-items-center rounded-[2px] border-2 bg-white ${vegetarian ? "border-emerald-600" : "border-red-700"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${vegetarian ? "bg-emerald-600" : "bg-red-700"}`} />
    </span>
  );
}

function FoodPlateIcon({ label }: { label: string }) {
  return (
    <svg viewBox="0 0 96 96" role="img" aria-label={label} className="h-12 w-12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="48" cy="48" r="25" stroke="currentColor" strokeWidth="8" />
      <circle cx="48" cy="48" r="12" fill="currentColor" />
      <path d="M14 17v17M20 17v17M26 17v17M14 31c0 6 2 9 6 10v38" stroke="currentColor" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M78 79V17c-7 7-10 17-10 31h10" fill="currentColor" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CategoryTabIcon({ label, active }: { label: string; active: boolean }) {
  const Icon = label === "All dishes" ? null : categoryIconForFood(label);
  return (
    <span
      role="img"
      aria-label={label}
      className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl transition-colors ${active ? "bg-white/20 text-white" : "bg-orange-50 text-orange-600"}`}
    >
      {Icon ? <Icon className="h-7 w-7" strokeWidth={2.5} aria-hidden="true" /> : <ServingDishIcon />}
    </span>
  );
}

function ServingDishIcon() {
  return (
    <svg viewBox="0 0 64 64" className="h-8 w-8" fill="currentColor" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
      <path d="M29 10a4 4 0 1 1 8 0v1.2C45.4 13.3 52 20.8 52 30H12c0-9.2 6.6-16.7 15-18.8V10h2Z" />
      <rect x="8" y="30" width="48" height="4" rx="2" />
      <path d="M11 40h8v14h-8V40Zm11 3.5c3.3-3.7 7.6-5.5 12.8-5.5h6.7a4.5 4.5 0 0 1 0 9H35v2h9.5l8.7-8.7a4.2 4.2 0 0 1 5.9 5.9L48.3 57H22V43.5Z" />
    </svg>
  );
}

function BottomNavButton({ label, icon: Icon, active, disabled, badge, onClick }: { label: string; icon: LucideIcon; active: boolean; disabled?: boolean; badge?: number; onClick: () => void }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} aria-current={active ? "page" : undefined} className={`relative flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${active ? "bg-orange-50 text-orange-600" : "text-slate-500"}`}>
      <span className="relative"><Icon className="h-5 w-5" />{badge ? <span className="absolute -right-3 -top-2 grid h-5 min-w-5 place-items-center rounded-full bg-orange-600 px-1 text-[10px] text-white">{badge}</span> : null}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}
