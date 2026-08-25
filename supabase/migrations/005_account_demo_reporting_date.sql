-- Existing FieldFlow accounts contain the synthetic demonstration dataset.
-- A null date means a real account follows the actual current date.
alter table public.accounts
  add column if not exists demo_reporting_date date;

update public.accounts
set demo_reporting_date = date '2026-08-19'
where demo_reporting_date is null
  and created_at < now();

comment on column public.accounts.demo_reporting_date is
  'Optional reporting date for synthetic demo accounts. Null uses the real current date.';
