# Analytics integration handoff

Analytics currently reads the shared sample jobs. Its calculations now live in `src/analyticsSummary.js`, so other FieldFlow areas can use the same definitions for date periods, new clients, repeat clients, and weekly trends.

## Scheduling handoff

Analytics creates a link with these query values:

```text
?account_id=acct_northstar&start=YYYY-MM-DD&end=YYYY-MM-DD
```

Scheduling can read these values and filter its job list to the selected period. Once Scheduling stores jobs through the shared API, Analytics should load those same account-scoped jobs instead of its bundled sample data.

## Chat handoff

The Analytics page has a **Copy summary for Chat** button. The copied text provides a user-readable current-period summary. Chatbot can later import `chatSummaryText` from `src/analyticsSummary.js` or request the API endpoint below.

## API handoff

The documented endpoint is:

```text
GET /api/v1/accounts/:account_id/analytics/summary?start=YYYY-MM-DD&end=YYYY-MM-DD
```

Suggested response shape:

```json
{
  "period": { "start": "2026-08-17", "end": "2026-08-24" },
  "jobs": 14,
  "previous_period_jobs": 11,
  "change_percent": 27,
  "new_clients": 5,
  "repeat_clients": 4,
  "weekly_trend": [{ "week_start": "2026-07-27", "jobs": 8 }]
}
```

When this endpoint exists, replace the bundled `jobs.json` input in `AnalyticsPage.jsx` with its response. Keep `account_id` scoped on every request.
