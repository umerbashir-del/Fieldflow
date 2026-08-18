# FieldFlow data model

## Account

`accounts.json` represents the tenant. `id` is the canonical `account_id` used by every related record.

## Client

Each client belongs to one account and has a stable `id`. Client records are intentionally small; operational notes should be stored through the API rather than copied into products.

## Job

A job belongs to one account and one client. `scheduled_for` is an ISO date, and `status` follows the shared status vocabulary.

## Relationship summary

```text
Account (1) ──< Client (many)
Account (1) ──< Job (many)
Client  (1) ──< Job (many)
```
