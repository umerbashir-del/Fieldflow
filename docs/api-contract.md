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
