# FieldFlow Supabase setup

This folder holds the database setup for FieldFlow. It does not contain credentials.

## First-time setup

1. Create a Supabase project.
2. In **Authentication → Providers**, leave Email enabled. For an MVP, create two email/password users in **Authentication → Users**.
3. Open **SQL Editor**, paste and run [`migrations/001_initial_schema.sql`](migrations/001_initial_schema.sql).
4. Copy [`.env.example`](../.env.example) to `.env` and add the Project URL, publishable key, and service-role key. Keep `.env` private.
5. Run `npm run seed:supabase` from the repository root. This imports only the clean canonical JSON data, not the intentional-error synthetic fixture.
6. In SQL Editor, add each login to its company. Replace each UUID with the user's UUID from **Authentication → Users**:

```sql
insert into public.account_memberships (account_id, user_id, role)
values
  ('acct_northstar', 'JOHN_USER_UUID', 'owner'),
  ('acct_horizon', 'SARAH_USER_UUID', 'owner');
```

7. Start Analytics with `npm run dev:analytics`. With the two VITE values present, it displays a sign-in screen instead of the JSON demo.

## How the two-login test works

Sign in as John. Only records with `account_id = acct_northstar` can be returned. Sign out and sign in as Sarah. Only `acct_horizon` data can be returned. The browser query is additionally protected by database RLS, so changing an account ID in a request does not reveal the other company.

## Important security rule

`VITE_SUPABASE_PUBLISHABLE_KEY` is safe for the browser because RLS limits what it can read. `SUPABASE_SECRET_KEY` bypasses RLS and must only be used by the local seed script or a trusted server—never in frontend code or a `VITE_` variable.

## Quick verification

1. Create John and Sarah as separate users and give each one membership in a different account.
2. Sign in as John in Analytics. The heading and totals should be for Northstar only.
3. Sign out, then sign in as Sarah. The heading and totals should change to Horizon only.
4. In the browser developer tools, changing an `account_id` in a request must not return the other company's records. RLS should return an empty result.
