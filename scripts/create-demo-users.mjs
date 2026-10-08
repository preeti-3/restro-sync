import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key)
  throw new Error(
    "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.",
  );
const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const restaurantId = process.env.DEMO_RESTAURANT_ID ?? "00000000-0000-4000-8000-000000000001";
const users = [
  {
    email: process.env.DEMO_ADMIN_EMAIL,
    password: process.env.DEMO_ADMIN_PASSWORD,
    fullName: "Demo Admin",
    role: "ADMIN",
    membershipRole: "OWNER",
  },
  {
    email: process.env.DEMO_CASHIER_EMAIL,
    password: process.env.DEMO_CASHIER_PASSWORD,
    fullName: "Demo Cashier",
    role: "CASHIER",
    membershipRole: "CASHIER",
  },
  {
    email: process.env.DEMO_KITCHEN_EMAIL,
    password: process.env.DEMO_KITCHEN_PASSWORD,
    fullName: "Demo Kitchen",
    role: "KITCHEN",
    membershipRole: "KITCHEN",
  },
];

const { error: schemaError } = await admin
  .from("profiles")
  .select("id")
  .limit(1);
if (schemaError) {
  throw new Error(
    `Supabase schema is not ready. Apply supabase/migrations/202609300001_initial_schema.sql before creating users. ${schemaError.message}`,
  );
}

const { data: existingData, error: listError } =
  await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (listError) throw listError;

for (const user of users) {
  if (!user.email || !user.password)
    throw new Error(`Missing credentials for ${user.role}. See README.`);

  const existing = existingData.users.find(
    (candidate) => candidate.email?.toLowerCase() === user.email.toLowerCase(),
  );
  let userId;

  if (existing) {
    const { data, error } = await admin.auth.admin.updateUserById(existing.id, {
      password: user.password,
      email_confirm: true,
    });
    if (error) throw error;
    userId = data.user.id;
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
    });
    if (error) throw error;
    userId = data.user.id;
  }

  const { error: profileError } = await admin
    .from("profiles")
    .upsert(
      { id: userId, full_name: user.fullName, role: user.role, active: true },
      { onConflict: "id" },
    );
  if (profileError) {
    throw new Error(
      `Could not create the ${user.role} profile. Apply the Supabase migration first. ${profileError.message}`,
    );
  }
  const { error: membershipError } = await admin.from("restaurant_members").upsert({ restaurant_id: restaurantId, user_id: userId, role: user.membershipRole, active: true }, { onConflict: "restaurant_id,user_id" });
  if (membershipError) throw new Error(`Could not assign ${user.membershipRole} membership: ${membershipError.message}`);
  process.stdout.write(
    `${existing ? "Updated" : "Created"} ${user.role}: ${user.email}\n`,
  );
}
