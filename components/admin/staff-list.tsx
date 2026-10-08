"use client";

import { useState, useTransition } from "react";
import { Loader2, UserMinus } from "lucide-react";
import { updateMemberAccess } from "@/app/actions/staff";
import { Badge, Card } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";

type Staff = { id: string; role: "OWNER" | "ADMIN" | "CASHIER" | "KITCHEN"; active: boolean; profile: { full_name: string } | null };

export function StaffList({ staff, canManage }: { staff: Staff[]; canManage: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const change = (id: string, role: "ADMIN" | "CASHIER" | "KITCHEN" | "REMOVE") => start(async () => {
    const result = await updateMemberAccess(id, role);
    setError(result.error ?? "");
  });

  return <Card className="overflow-hidden">
    {error && <p role="alert" className="m-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <div className="overflow-x-auto"><table className="w-full text-left text-sm">
      <thead className="bg-slate-50 text-xs uppercase text-muted-foreground"><tr><th className="p-4">Team member</th><th className="p-4">Role</th><th className="p-4">Status</th><th className="p-4">Access</th></tr></thead>
      <tbody>{staff.map((person) => <tr key={person.id} className="border-t"><td className="p-4 font-semibold">{person.profile?.full_name ?? "Team member"}</td><td className="p-4"><Badge tone="info">{person.role}</Badge></td><td className="p-4"><Badge tone={person.active ? "success" : "neutral"}>{person.active ? "Active" : "Removed"}</Badge></td><td className="p-4"><div className="flex gap-2">
        {person.role !== "OWNER" && canManage ? <><select aria-label={`Role for ${person.profile?.full_name}`} className="min-h-11 rounded-lg border" value={person.role} disabled={pending || !person.active} onChange={(event) => change(person.id, event.target.value as "ADMIN" | "CASHIER" | "KITCHEN")}><option value="ADMIN">Admin</option><option value="CASHIER">Cashier</option><option value="KITCHEN">Kitchen</option></select><Button size="icon" variant="ghost" disabled={pending || !person.active} onClick={() => change(person.id, "REMOVE")} aria-label="Remove access">{pending ? <Loader2 className="animate-spin"/> : <UserMinus className="text-red-600"/>}</Button></> : <span className="text-xs text-muted-foreground">{person.role === "OWNER" ? "Owner account" : "View only"}</span>}
      </div></td></tr>)}</tbody>
    </table></div>
  </Card>;
}
