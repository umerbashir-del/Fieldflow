# FieldFlow data model

## Account

`accounts.json` represents the tenant. `id` is the canonical `account_id` used by every related record.

## Client

Each client belongs to one account and has a stable `id`. Client records are intentionally small; operational notes should be stored through the API rather than copied into products.

The client's service address is split into `building_number`, `street_name`, `city`, `state`, and `zip_code` rather than one free-text field, so scheduling and dispatch can validate and sort on it. `client_phone` is the number used for appointment communication.

## Job

A job belongs to one account and one client. `scheduled_for` is an ISO date, and `status` follows the shared status vocabulary.

## Relationship summary

```text
Account (1) ──< Client (many)
Account (1) ──< Job (many)
Client  (1) ──< Job (many)
```
