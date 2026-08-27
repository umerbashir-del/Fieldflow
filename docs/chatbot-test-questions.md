# Chatbot test questions

A manual testing checklist for the FieldFlow chatbot, derived from the automated
test suite (`chatbot/tests/model.test.js`). All account-scoped answers below
assume you're signed in as **John — Northstar Field Services**, since that's
the account the underlying seed data and exact wording are written against.

## Direct data lookups

| Ask | Expect |
| --- | --- |
| `job_071` | "Summer system inspection for Evergreen Properties is completed, scheduled for June 29, 2026 with Maya Chen." |
| `job_999` | "I can't find a job with id job_999." (a made-up ID — should not guess) |
| `job_201` | A refusal that it isn't part of Northstar's account — this job belongs to a different company (Horizon Electric), and the bot should never reveal it |
| What plan am I on? | "You're using the Growth plan for Northstar Field Services." |
| How many clients do we have? | "Northstar Field Services has 18 clients." |
| Tell me about Cedar Point Studios | "Cedar Point Studios is in Cary. They have 6 jobs on file, 0 still open." |
| Tell me about Arcade Market | A refusal — this client belongs to a different account (Horizon Electric) |
| What is on my schedule today? | A list of upcoming jobs, soonest first: Rooftop unit diagnosis, Warehouse HVAC estimate, Classroom airflow check |

## Curated FAQ answers

| Ask | Cites source |
| --- | --- |
| How do I create a job? | Scheduling |
| What are the possible statuses? | Jobs |
| Can other companies see my data? | Privacy — answer should say you can only see your own company's data |
| What date format do you use? | Scheduling |
| I need to talk to support | Support |

## Fallback behavior

| Ask | Expect |
| --- | --- |
| What fields make up a service address? | Falls back to a general "FieldFlow help" pointer (doesn't match a curated FAQ, but is recognized as an on-topic question) |
| Who won the game last night? | "I don't have documentation on that yet. Try asking how to create a job, what job statuses mean, how account scoping works, or what your plan is." — a fully unrelated question should never get a guessed answer |

## Built-in suggestion chips

These five appear as clickable chips in the widget itself for any signed-in user:

- How do I create a new job?
- What do job statuses mean?
- What's my plan?
- Why can't I see another company's jobs?
- What jobs do I have this week?

## Notes for peer testers

- The account-isolation checks (`job_201`, "Arcade Market") are the most
  important ones to verify — they confirm the bot never leaks another
  company's data, even when directly asked by ID or name.
- If signed in as **Sarah — Horizon Electric** or **Operations** instead, the
  account-scoped answers above will differ (or, for Operations, redirect to
  the Operations Dashboard for account-specific questions) — the FAQ and
  fallback behavior stays the same regardless of who's signed in.
