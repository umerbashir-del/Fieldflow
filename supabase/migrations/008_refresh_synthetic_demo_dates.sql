-- Refresh only the imported synthetic companies so their representative
-- reporting week is current as of August 25, 2026. Real accounts are not
-- included in this migration.

with synthetic_accounts as (
  select
    id,
    (date '2026-08-25' - demo_reporting_date) as day_shift
  from public.accounts
  where id in (
    'acct_brightspark', 'acct_clearview', 'acct_coastal', 'acct_greenscape',
    'acct_horizon', 'acct_ironclad', 'acct_northstar', 'acct_riverstone',
    'acct_summitpaint', 'acct_truenorth'
  )
  and demo_reporting_date is not null
)
update public.jobs as jobs
set scheduled_for = jobs.scheduled_for + synthetic_accounts.day_shift
from synthetic_accounts
where jobs.account_id = synthetic_accounts.id;

update public.accounts
set demo_reporting_date = date '2026-08-25'
where id in (
  'acct_brightspark', 'acct_clearview', 'acct_coastal', 'acct_greenscape',
  'acct_horizon', 'acct_ironclad', 'acct_northstar', 'acct_riverstone',
  'acct_summitpaint', 'acct_truenorth'
);
