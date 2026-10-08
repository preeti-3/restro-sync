import { createClient } from "@/lib/supabase/server";
import { StaffList } from "@/components/admin/staff-list";
import { StaffInviteForm } from "@/components/admin/staff-invite-form";
import { requireRole } from "@/lib/auth/session";

export default async function StaffPage() {
  const profile = await requireRole("OWNER", "ADMIN");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("restaurant_members")
    .select("id,role,active,profile:profiles(full_name)")
    .eq("restaurant_id", profile.membership.restaurant_id)
    .order("created_at");

  if (error) throw new Error(`Unable to load restaurant staff: ${error.message}`);
  const staff = (data ?? []).map((row) => ({ ...row, profile: Array.isArray(row.profile) ? row.profile[0] ?? null : row.profile }));

  return <div className="space-y-6">
    <div><h1 className="font-display text-2xl font-bold">Staff &amp; roles</h1><p className="text-sm text-muted-foreground">View the shared restaurant team and manage role-specific access.</p></div>
    {profile.membership.role === "OWNER" && <StaffInviteForm />}
    <StaffList staff={staff as never} canManage={profile.membership.role === "OWNER"} />
  </div>;
}
