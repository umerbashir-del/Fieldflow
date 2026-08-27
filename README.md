# FieldFlow

FieldFlow is a four-person B2B SaaS workspace for field-service teams. Each product area is independently owned but uses the same account-scoped data and API conventions.

## Start an area

1. Run `npm install`.
2. Run one of the following:
   - `npm run dev:scheduling`
   - `npm run dev:ops`
   - `npm run dev:chatbot`
   - `npm run dev:analytics`

All visible dates use the format `Month Day, Year` (for example, `August 20, 2026`).

## Backend and sign-in

FieldFlow now includes a Supabase/PostgreSQL backend foundation: secure account-scoped tables, Row Level Security, a sample-data importer, and an Analytics sign-in screen. Follow [the Supabase setup guide](supabase/README.md) to connect a project. Until `.env` is configured, Analytics continues to show its existing local demo data.

For a production release, follow [the FieldFlow deployment guide](docs/deployment.md). The production build places all four products on one domain so they share one secure Supabase browser session.

## Internal Operations Dashboard

The Internal Operations Dashboard gives FieldFlow staff a read-only view across customer companies, rather than the single-company view a contractor sees. It helps the FieldFlow team understand which accounts are active, how many clients and jobs each company has, how much work is completed or still open, and which companies may need attention.

It uses the same account, client, and job data as Scheduling, Analytics, and Support. Scheduling records the day-to-day work; Analytics turns one company’s jobs into business insights; Support explains those insights in plain language; and Operations brings together account-level summaries so FieldFlow staff can support the whole customer base without changing contractor data. Operations access is restricted to approved staff accounts and is intentionally read-only for customer records.

## Ownership

| Area | Owner |
| --- | --- |
| Scheduling | Cheich Toure |
| Internal Ops Dashboard | John Ajala|
| Chat Box | Soma Majumder |
| Analysis / Customer Analytics | Umer Bashir|
