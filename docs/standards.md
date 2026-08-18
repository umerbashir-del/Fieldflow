# FieldFlow standards

## Account scope

Every stored record and every API request is scoped by `account_id`. The client must never infer an account from a display name or email address.

## Dates

Store dates as ISO 8601 values (`YYYY-MM-DD` or a full UTC timestamp). Display dates as `Month Day, Year`, such as `August 20, 2026`.

## Shared behavior

- Use a clear loading, empty, and error state for all data views.
- Preserve filters while a user moves within an area.
- Use the shared status vocabulary: `scheduled`, `in_progress`, `completed`, `cancelled`.
- Never place credentials, private customer notes, or personally identifiable information in client-side sample data.

## Components

Each area owns its screens and feature-specific components. Reusable formatting and cross-product data helpers belong in `shared-data/` until a dedicated shared UI package is introduced.
