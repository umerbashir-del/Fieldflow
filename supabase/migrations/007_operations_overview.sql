-- Compact Operations overview. Account detail remains an on-demand query.

create or replace function public.get_operations_overview()
returns table (
  id text,
  name text,
  plan text,
  demo_reporting_date date,
  client_count bigint,
  job_count bigint,
  completed_count bigint,
  open_count bigint,
  in_progress_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with client_totals as (
    select account_id, count(*) as client_count
    from public.clients
    group by account_id
  ), job_totals as (
    select
      account_id,
      count(*) as job_count,
      count(*) filter (where status = 'completed') as completed_count,
      count(*) filter (where status in ('scheduled', 'in_progress')) as open_count,
      count(*) filter (where status = 'in_progress') as in_progress_count
    from public.jobs
    group by account_id
  )
  select
    accounts.id,
    accounts.name,
    accounts.plan,
    accounts.demo_reporting_date,
    coalesce(client_totals.client_count, 0),
    coalesce(job_totals.job_count, 0),
    coalesce(job_totals.completed_count, 0),
    coalesce(job_totals.open_count, 0),
    coalesce(job_totals.in_progress_count, 0)
  from public.accounts
  left join client_totals on client_totals.account_id = accounts.id
  left join job_totals on job_totals.account_id = accounts.id
  where public.is_operations_staff()
  order by accounts.name;
$$;

revoke all on function public.get_operations_overview() from public;
grant execute on function public.get_operations_overview() to authenticated;
