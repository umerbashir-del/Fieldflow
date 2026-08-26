-- Optional data needed for future revenue and performance reporting.
-- Every new column is nullable so existing jobs continue to work unchanged.

alter table public.jobs
  add column if not exists invoice_total numeric(12, 2),
  add column if not exists estimated_duration_minutes integer,
  add column if not exists actual_duration_minutes integer,
  add column if not exists job_category text,
  add column if not exists completed_at timestamptz,
  add column if not exists lead_source text,
  add column if not exists technician_id uuid references auth.users(id) on delete set null,
  add column if not exists customer_satisfaction_rating smallint;

alter table public.jobs
  drop constraint if exists jobs_invoice_total_nonnegative,
  add constraint jobs_invoice_total_nonnegative check (invoice_total is null or invoice_total >= 0),
  drop constraint if exists jobs_estimated_duration_positive,
  add constraint jobs_estimated_duration_positive check (estimated_duration_minutes is null or estimated_duration_minutes > 0),
  drop constraint if exists jobs_actual_duration_nonnegative,
  add constraint jobs_actual_duration_nonnegative check (actual_duration_minutes is null or actual_duration_minutes >= 0),
  drop constraint if exists jobs_satisfaction_rating_range,
  add constraint jobs_satisfaction_rating_range check (customer_satisfaction_rating is null or customer_satisfaction_rating between 1 and 5);

create index if not exists jobs_account_completed_at_idx
  on public.jobs (account_id, completed_at desc)
  where completed_at is not null;

create index if not exists jobs_account_technician_idx
  on public.jobs (account_id, technician_id)
  where technician_id is not null;

comment on column public.jobs.invoice_total is 'Final invoiced amount, in the account default currency.';
comment on column public.jobs.estimated_duration_minutes is 'Expected on-site work time in minutes.';
comment on column public.jobs.actual_duration_minutes is 'Actual work time in minutes.';
comment on column public.jobs.job_category is 'Optional service category, such as plumbing repair or installation.';
comment on column public.jobs.completed_at is 'When the job was marked completed.';
comment on column public.jobs.lead_source is 'How the client or job was acquired.';
comment on column public.jobs.technician_id is 'Assigned technician user, when the assignee is a FieldFlow user.';
comment on column public.jobs.customer_satisfaction_rating is 'Optional client rating from 1 (low) to 5 (high).';
