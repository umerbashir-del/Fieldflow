-- Operations accounts are at risk when they have fewer than ten jobs in the
-- calendar month containing their reporting date. Demo accounts use their
-- configured demo_reporting_date; live accounts use the current date.

drop function if exists public.get_operations_account_summaries();

create function public.get_operations_account_summaries()
returns table (
  id text,
  name text,
  plan text,
  demo_reporting_date date,
  client_count bigint,
  job_count bigint,
  completed_count bigint,
  open_count bigint,
  jobs_this_month bigint
)
language sql
security invoker
set search_path = public
as $$
  select
    accounts.id,
    accounts.name,
    accounts.plan,
    accounts.demo_reporting_date,
    count(distinct clients.id) as client_count,
    count(distinct jobs.id) as job_count,
    count(distinct jobs.id) filter (where jobs.status = 'completed') as completed_count,
    count(distinct jobs.id) filter (where jobs.status in ('scheduled', 'in_progress')) as open_count,
    count(distinct jobs.id) filter (
      where jobs.scheduled_for >= date_trunc('month', coalesce(accounts.demo_reporting_date, current_date))::date
        and jobs.scheduled_for < (date_trunc('month', coalesce(accounts.demo_reporting_date, current_date)) + interval '1 month')::date
    ) as jobs_this_month
  from public.accounts
  left join public.clients on clients.account_id = accounts.id
  left join public.jobs on jobs.account_id = accounts.id
  where public.is_operations_staff()
  group by accounts.id, accounts.name, accounts.plan, accounts.demo_reporting_date
  order by accounts.name;
$$;

revoke all on function public.get_operations_account_summaries() from public;
grant execute on function public.get_operations_account_summaries() to authenticated;
