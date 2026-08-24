-- Operations staff are provisioned by FieldFlow administrators. They are not
-- public business sign-ups and they do not rely on a browser-supplied role.
create table public.operations_staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_operations_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.operations_staff where user_id = auth.uid()
  );
$$;

revoke all on function public.is_operations_staff() from public;
grant execute on function public.is_operations_staff() to authenticated;

alter table public.operations_staff enable row level security;
create policy "Operations staff can confirm their own staff record" on public.operations_staff
  for select to authenticated using (user_id = auth.uid());

-- Operations can review records but cannot change customer data through the
-- browser. Existing member policies continue to control all write access.
create policy "Operations staff can read all accounts" on public.accounts
  for select to authenticated using (public.is_operations_staff());
create policy "Operations staff can read all memberships" on public.account_memberships
  for select to authenticated using (public.is_operations_staff());
create policy "Operations staff can read all clients" on public.clients
  for select to authenticated using (public.is_operations_staff());
create policy "Operations staff can read all jobs" on public.jobs
  for select to authenticated using (public.is_operations_staff());
create policy "Operations staff can read all chat messages" on public.chat_messages
  for select to authenticated using (public.is_operations_staff());

-- Permit staff summaries while retaining the existing account-member check.
create or replace function public.get_analytics_summary(
  requested_account_id text,
  period_start date,
  period_end date
)
returns table (
  account_id text,
  selected_jobs bigint,
  previous_jobs bigint,
  change_percent integer,
  new_clients bigint,
  repeat_clients bigint
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  previous_start date := period_start - (period_end - period_start);
begin
  if period_end <= period_start then raise exception 'period_end must be after period_start'; end if;
  if not (public.is_account_member(requested_account_id) or public.is_operations_staff()) then return; end if;
  return query
  with selected as (select client_id from public.jobs where jobs.account_id = requested_account_id and scheduled_for >= period_start and scheduled_for < period_end),
  previous as (select client_id from public.jobs where jobs.account_id = requested_account_id and scheduled_for >= previous_start and scheduled_for < period_start),
  client_mix as (select distinct selected.client_id, exists (select 1 from public.jobs prior where prior.account_id = requested_account_id and prior.client_id = selected.client_id and prior.scheduled_for < period_start) as is_repeat from selected)
  select requested_account_id, (select count(*) from selected), (select count(*) from previous),
    case when (select count(*) from previous) = 0 then null else round((((select count(*) from selected) - (select count(*) from previous))::numeric / (select count(*) from previous)) * 100)::integer end,
    (select count(*) from client_mix where not is_repeat), (select count(*) from client_mix where is_repeat);
end;
$$;
