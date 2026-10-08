"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { acceptInvitation } from "@/app/actions/staff";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/primitives";

export function AcceptInvite({ token }: { token: string }) {
  const [pending, start] = useTransition();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  function accept() {
    setError("");
    if (password.length < 10) return setError("Use a password of at least 10 characters.");
    if (password !== confirmation) return setError("Passwords do not match.");
    start(async () => {
      const result = await acceptInvitation(token, password);
      if (result.error) setError(result.error);
      else router.push("/");
    });
  }

  return <div className="space-y-4 text-left">
    <div>
      <Label htmlFor="invite-password">Create password</Label>
      <Input id="invite-password" type="password" autoComplete="new-password" minLength={10} value={password} onChange={(event) => setPassword(event.target.value)} disabled={pending} />
      <p className="mt-1 text-xs text-muted-foreground">Use at least 10 characters. This will be your RestroSync sign-in password.</p>
    </div>
    <div>
      <Label htmlFor="invite-password-confirmation">Confirm password</Label>
      <Input id="invite-password-confirmation" type="password" autoComplete="new-password" minLength={10} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} disabled={pending} />
    </div>
    <Button className="w-full" size="lg" disabled={pending || !password || !confirmation} onClick={accept}>
      {pending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
      {pending ? "Setting up account…" : "Set password and accept"}
    </Button>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700">{error}</p>}
  </div>;
}
