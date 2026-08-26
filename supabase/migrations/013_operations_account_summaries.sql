-- Load compact, read-only Operations summaries before fetching any individual
-- company detail. This keeps the Operations home page fast as data grows.

create or replace function public.get_operations_account_summaries()
returns table (
  id text,
  name text,
  plan text,
  demo_reporting_date date,
  client_count bigint,
  job_count bigint,
  completed_count bigint,
  open_count bigint
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
    count(distinct jobs.id) filter (where jobs.status in ('scheduled', 'in_progress')) as open_count
  from public.accounts
  left join public.clients on clients.account_id = accounts.id
  left join public.jobs on jobs.account_id = accounts.id
  where public.is_operations_staff()
  group by accounts.id, accounts.name, accounts.plan, accounts.demo_reporting_date
  order by accounts.name;
$$;

revoke all on function public.get_operations_account_summaries() from public;
grant execute on function public.get_operations_account_summaries() to authenticated;
