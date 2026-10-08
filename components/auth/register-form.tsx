"use client";
import { useActionState } from "react";
import { Loader2, Store } from "lucide-react";
import { registerRestaurant, type AuthState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/primitives";

export function RegisterForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(registerRestaurant, {});
  return <form action={action} className="space-y-4">
    <div className="grid gap-4 sm:grid-cols-2"><div><Label htmlFor="ownerName">Owner name</Label><Input id="ownerName" name="ownerName" autoComplete="name" required /></div><div><Label htmlFor="phone">Contact number</Label><Input id="phone" name="phone" type="tel" autoComplete="tel" required /></div></div>
    <div><Label htmlFor="restaurantName">Restaurant name</Label><Input id="restaurantName" name="restaurantName" required /></div>
    <div><Label htmlFor="address">Restaurant address</Label><Input id="address" name="address" autoComplete="street-address" required /></div>
    <div><Label htmlFor="email">Owner email</Label><Input id="email" name="email" type="email" autoComplete="email" required /></div>
    <div><Label htmlFor="password">Password</Label><Input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required /><p className="mt-1 text-xs text-muted-foreground">Use at least 10 characters.</p></div>
    {state.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700">{state.error}</p>}
    <Button className="w-full" size="lg" disabled={pending}>{pending ? <Loader2 className="animate-spin"/> : <Store/>}{pending ? "Creating restaurant…" : "Register restaurant"}</Button>
  </form>;
}
