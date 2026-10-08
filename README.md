# RestroSync

RestroSync is a multi-restaurant operations platform built with Next.js 15, TypeScript, Tailwind, Supabase Auth/PostgreSQL/RLS/Realtime, Zod, and Recharts. Each restaurant has one outlet today and an isolated owner/admin, cashier, kitchen, and customer-QR workspace.

## Multi-restaurant capabilities

- Public restaurant-owner registration creates the Auth user, restaurant, settings row, and `OWNER` membership in one database transaction. New restaurants are `PENDING`.
- A separate `/platform` console approves, suspends, and reactivates restaurants and shows registration and order activity.
- Every restaurant-owned table has a non-null `restaurant_id`. RLS, scoped RPCs, composite tenant foreign keys, explicit server filters, and realtime filters prevent cross-restaurant access.
- Owners can issue seven-day, recipient-bound invitations and change or remove staff membership. Staff cannot mutate their own membership or create invitations.
- Opaque table QR tokens resolve to a restaurant/table. Guest cookies are tied to that QR, restaurant, table, and visit. Suspended restaurants cannot open sessions or create orders.
- Direct UPI remains restaurant-specific and manual-verification only. No payment gateway is used.

## Setup and migration

1. Copy `.env.example` to `.env.local` and configure the Supabase URL, publishable key, server-only service-role key, and public app URL. Never expose `SUPABASE_SERVICE_ROLE_KEY` through a `NEXT_PUBLIC_` variable.
2. Install packages with `npm install`.
3. For an **existing populated installation**, explicitly select the legacy owner before applying the multi-restaurant migration. In the Supabase SQL Editor, run the following with the real existing Auth user email. This intentionally fails closed instead of guessing:

   ```sql
   create table if not exists public.restrosync_migration_config (
     key text primary key,
     value text not null,
     created_at timestamptz not null default now()
   );

   revoke all on public.restrosync_migration_config
   from public, anon, authenticated;

   insert into public.restrosync_migration_config(key, value)
   values ('legacy_owner_email', 'owner@your-restaurant.com')
   on conflict (key) do update set value = excluded.value;
   ```

   The email must already exist in `auth.users`. The migration creates or reactivates its legacy profile and assigns it as `OWNER`. Verify the value before migrating:

   ```sql
   select value
   from public.restrosync_migration_config
   where key = 'legacy_owner_email';
   ```

   All existing restaurant rows and active profiles are attached to the preserved default restaurant; the configured account becomes `OWNER`. The migration drops this temporary configuration table after successful assignment.

4. Apply migrations in filename order:

   ```bash
   supabase link --project-ref YOUR_PROJECT_REF
   supabase db push
   ```

   Do not use `db reset` on an existing environment. The migration adds and backfills tenant keys without deleting data. It adds tenant indexes, composite foreign keys, RLS policies, status checks, scoped RPCs, and storage policies. Application assets must use `restaurant-assets/<restaurant_uuid>/...` paths.
5. On a new local database only, `supabase db reset` applies the demo seed. Run `node scripts/create-demo-users.mjs` after supplying the documented demo credentials; `DEMO_RESTAURANT_ID` is optional and defaults to the seeded restaurant.
6. Start with `npm run dev` and register a restaurant at `/register`.
7. In the hosted Supabase Dashboard, open **Authentication → URL Configuration**. Set **Site URL** to your deployed origin (for example `https://restro-sync.vercel.app`) and add `https://restro-sync.vercel.app/**` to **Redirect URLs**. Also set `APP_URL` and `NEXT_PUBLIC_APP_URL` to that same HTTPS origin in the deployment environment. This prevents confirmation and invitation emails from falling back to localhost.
8. Under **Authentication → Email Templates**, set the invite subject to `You’re invited to join RestroSync` and the confirmation subject to `Confirm your RestroSync account`. Copy the matching HTML from `supabase/templates/`; `config.toml` applies these templates to local Supabase, while hosted projects are configured in the Dashboard.

## Securely provision the first platform admin

Public registration can never create a platform administrator. First create and email-confirm a dedicated user in Supabase Authentication. Then run the server-side provisioning script from a trusted shell:

```text
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-server-only-service-role-key
PLATFORM_ADMIN_EMAIL=platform-owner@example.com
```

```bash
node scripts/provision-platform-admin.mjs
```

Remove the temporary service-role environment variable from the shell afterward. The script requires an existing Auth user and writes `platform_admins` using the service role; no browser or public RPC can assign this role.

## Staff invitations

Owners create invitations under Admin → Staff. The generated URL contains the only plaintext copy of a random token; the database stores its SHA-256 hash. Deliver the link through a trusted channel. The recipient signs in with the exact invited email and accepts within seven days. Owners can then change the restaurant-specific role or remove access.

## QR and UPI

Configure each restaurant’s UPI ID/payee under Admin → Settings, then generate table QRs under Admin → Tables. Regeneration invalidates future scans of the old token without exposing previous visits. Cashiers verify UPI claims in the restaurant’s bank/UPI app before approving them; a redirect, screenshot, or reference is never payment proof.

## Verification

Run application checks:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

For a staging isolation test, create two approved restaurants and users A/B, then verify:

1. A REST request authenticated as A returns zero rows when filtering by B’s restaurant, order, table, or menu IDs.
2. A mutation/RPC using B’s table/menu/order IDs returns `Forbidden`, `unavailable`, or a composite foreign-key failure.
3. A realtime channel authenticated as A with B’s `restaurant_id` filter receives no rows because realtime applies table SELECT RLS; A’s own filtered channel continues to update.
4. A pending or suspended restaurant cannot read operational rows, open a QR guest session, or submit a guest order. Reactivation restores access.
5. Cashier and kitchen members cannot create invitations, change memberships, edit settings/menu, or call platform RPCs. Owners can change/remove only non-owner memberships in their restaurant.
6. QR tokens for restaurant A show only A’s menu/table/branding. An order ID from B returns 404 in A’s guest session. Bills use the owning restaurant’s UPI values.
7. Complete registration → approval → onboarding checklist → staff invitation → QR order → manual UPI verification for both tenants.

The main enforcement is in `supabase/migrations/202610050001_multi_restaurant_platform.sql`; UI filters are defense in depth, not the authorization boundary.
