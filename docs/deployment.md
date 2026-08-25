# FieldFlow production deployment

FieldFlow deploys as one Vercel site with four paths. Keeping the products on
one origin allows the Supabase browser session to follow the user safely:

- `/scheduling/` — contractor sign-in and Scheduling
- `/analytics/` — Customer Analytics
- `/support/` — account-scoped Chatbot
- `/operations/` — staff-only Operations Dashboard

## 1. Create and configure Supabase

1. Create a Supabase project and save its database password in a password manager.
2. From the repository root, link the Supabase CLI to the new project.
3. Preview the database changes with `npx supabase db push --dry-run`.
4. Apply all migrations with `npx supabase db push`.
5. Copy `.env.example` to `.env` and enter the project URL, publishable key,
   and secret key. Never commit `.env` or expose the secret key to Vite.
6. Import the canonical starter data with `npm run seed:supabase`.

The migrations enable Row Level Security for every customer-data table. Public
business registration can only create a brand-new Starter account and owner
membership. Operations access must be granted manually by inserting the staff
user UUID into `public.operations_staff`.

## 2. Configure authentication

In Supabase Authentication:

1. Keep Email/Password enabled.
2. Set the Site URL to the production Vercel domain.
3. Add `https://YOUR-DOMAIN/scheduling/` to the allowed redirect URLs.
4. Decide whether email confirmation is required before launch.
5. Create the Operations user, then add its UUID to `operations_staff` as
   described in `supabase/README.md`.

## 3. Deploy one Vercel project

1. Import the FieldFlow GitHub repository into Vercel.
2. Keep the project Root Directory at the repository root.
3. Vercel reads `vercel.json`, runs `npm run build:deploy`, and publishes
   `deploy/`.
4. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` to Production
   and Preview environment variables.
5. Do **not** add `SUPABASE_SECRET_KEY` to the frontend deployment. It is only
   needed in a trusted local or CI seeding environment.
6. Deploy and open `/scheduling/` first.

The four optional `VITE_*_URL` settings are only needed when products are
deliberately hosted on different origins. The recommended single-site build
derives its links from the current production origin automatically.

Production builds compile with demo mode disabled. The repository JSON files
remain test fixtures and local-development fallback data; deployed users must
authenticate with Supabase and receive their permitted rows through RLS.

## 4. Production checks

- A contractor can only read and change rows for their membership account.
- A second contractor cannot retrieve the first contractor's clients or jobs.
- An Operations login can read every account but cannot change customer rows.
- Scheduling changes appear after opening Analytics or Support.
- Signing out removes access to all four product paths.
- No demo credentials or service-role keys appear in the deployed JavaScript.
