-- Populate only the synthetic demonstration records with believable optional
-- values. Existing real-account values and any manually entered values remain
-- untouched. Run this after 007_job_performance_fields.sql.

with synthetic_jobs as (
  select id, status, scheduled_for, abs(hashtext(id)) as stable_value
  from public.jobs
  where account_id in (
    'acct_brightspark', 'acct_clearview', 'acct_coastal', 'acct_greenscape',
    'acct_horizon', 'acct_ironclad', 'acct_northstar', 'acct_riverstone',
    'acct_summitpaint', 'acct_truenorth'
  )
)
update public.jobs as jobs
set
  job_category = coalesce(jobs.job_category, (array['Repair', 'Maintenance', 'Installation', 'Inspection'])[1 + (synthetic_jobs.stable_value % 4)]),
  lead_source = coalesce(jobs.lead_source, (array['Referral', 'Website', 'Google', 'Repeat client'])[1 + (synthetic_jobs.stable_value % 4)]),
  estimated_duration_minutes = coalesce(jobs.estimated_duration_minutes, (array[60, 90, 120, 180])[1 + (synthetic_jobs.stable_value % 4)]),
  actual_duration_minutes = coalesce(jobs.actual_duration_minutes, case when synthetic_jobs.status = 'completed' then (array[45, 90, 135])[1 + (synthetic_jobs.stable_value % 3)] else null end),
  invoice_total = coalesce(jobs.invoice_total, case when synthetic_jobs.status = 'completed' then 145 + (synthetic_jobs.stable_value % 8) * 55 else null end),
  completed_at = coalesce(jobs.completed_at, case when synthetic_jobs.status = 'completed' then synthetic_jobs.scheduled_for::timestamptz + interval '17 hours' else null end),
  customer_satisfaction_rating = coalesce(jobs.customer_satisfaction_rating, case when synthetic_jobs.status = 'completed' then 3 + (synthetic_jobs.stable_value % 3) else null end)
from synthetic_jobs
where jobs.id = synthetic_jobs.id;
