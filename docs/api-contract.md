# FieldFlow API contract

All endpoints are versioned under `/api/v1` and require an authenticated account context.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/accounts/:account_id/jobs` | List jobs, optionally filtered by status or date |
| POST | `/accounts/:account_id/jobs` | Create a job |
| PATCH | `/accounts/:account_id/jobs/:job_id` | Update a job or its status |
| GET | `/accounts/:account_id/clients` | List clients |
| GET | `/accounts/:account_id/analytics/summary` | Return account-scoped metrics |
| POST | `/accounts/:account_id/chat/messages` | Send a support or operations message |

Responses use JSON. Date fields are ISO values. Errors use `{ "error": { "code": "...", "message": "..." } }` and must never reveal records from another account.

## Supabase implementation

The first backend implementation uses Supabase directly from the product areas. Each request is authenticated through Supabase Auth and Row Level Security (RLS) limits it to the signed-in user's account membership. A browser must never use the service-role key or rely on a user-supplied `account_id` for authorization.

`get_analytics_summary(account_id, start_date, end_date)` is the database function behind the Analytics summary. It returns no data when the user does not belong to the requested account.
