-- FieldFlow's first Supabase schema.
-- Run this file in Supabase Dashboard > SQL Editor, or through the Supabase CLI.

create table public.accounts (
  id text primary key,
  name text not null,
  plan text not null check (plan in ('Starter', 'Growth', 'Pro')),
  created_at timestamptz not null default now()
);

create table public.account_memberships (
  account_id text not null references public.accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'dispatcher', 'technician', 'ops')),
  created_at timestamptz not null default now(),
  primary key (account_id, user_id)
);

create table public.clients (
  id text primary key,
  account_id text not null references public.accounts(id) on delete cascade,
  name text not null,
  building_number text,
  street_name text,
  city text,
  state text,
  zip_code text,
  client_phone text,
  created_at timestamptz not null default now(),
  unique (account_id, id)
);

create table public.jobs (
  id text primary key,
  account_id text not null references public.accounts(id) on delete cascade,
  client_id text not null,
  title text not null,
  scheduled_for date not null,
  status text not null check (status in ('scheduled', 'in_progress', 'completed', 'cancelled')),
  assignee text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (account_id, client_id) references public.clients(account_id, id)
);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  account_id text not null references public.accounts(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index jobs_account_scheduled_for_idx on public.jobs (account_id, scheduled_for);
create index jobs_account_client_idx on public.jobs (account_id, client_id);
create index clients_account_name_idx on public.clients (account_id, name);
create index memberships_user_idx on public.account_memberships (user_id);
create index chat_messages_account_created_idx on public.chat_messages (account_id, created_at desc);

-- This function is used in the policies below. It deliberately reads only the
-- signed-in user's own membership, not a browser-supplied account identity.
create or replace function public.is_account_member(target_account_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.account_memberships
    where account_id = target_account_id
      and user_id = auth.uid()
  );
$$;

revoke all on function public.is_account_member(text) from public;
grant execute on function public.is_account_member(text) to authenticated;

alter table public.accounts enable row level security;
alter table public.account_memberships enable row level security;
alter table public.clients enable row level security;
alter table public.jobs enable row level security;
alter table public.chat_messages enable row level security;

create policy "Members can read their account" on public.accounts
  for select to authenticated using (public.is_account_member(id));

create policy "Users can read their own memberships" on public.account_memberships
  for select to authenticated using (user_id = auth.uid());

create policy "Members can read clients in their account" on public.clients
  for select to authenticated using (public.is_account_member(account_id));
create policy "Members can create clients in their account" on public.clients
  for insert to authenticated with check (public.is_account_member(account_id));
create policy "Members can update clients in their account" on public.clients
  for update to authenticated using (public.is_account_member(account_id)) with check (public.is_account_member(account_id));
create policy "Members can delete clients in their account" on public.clients
  for delete to authenticated using (public.is_account_member(account_id));

create policy "Members can read jobs in their account" on public.jobs
  for select to authenticated using (public.is_account_member(account_id));
create policy "Members can create jobs in their account" on public.jobs
  for insert to authenticated with check (public.is_account_member(account_id));
create policy "Members can update jobs in their account" on public.jobs
  for update to authenticated using (public.is_account_member(account_id)) with check (public.is_account_member(account_id));
create policy "Members can delete jobs in their account" on public.jobs
  for delete to authenticated using (public.is_account_member(account_id));

create policy "Members can read their account chat" on public.chat_messages
  for select to authenticated using (public.is_account_member(account_id));
create policy "Members can send their account chat" on public.chat_messages
  for insert to authenticated with check (public.is_account_member(account_id) and author_id = auth.uid());

-- The database, rather than the browser, calculates the key Analytics totals.
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
  if period_end <= period_start then
    raise exception 'period_end must be after period_start';
  end if;
  if not public.is_account_member(requested_account_id) then
    return;
  end if;

  return query
  with selected as (
    select client_id from public.jobs
    where jobs.account_id = requested_account_id
      and scheduled_for >= period_start and scheduled_for < period_end
  ), previous as (
    select client_id from public.jobs
    where jobs.account_id = requested_account_id
      and scheduled_for >= previous_start and scheduled_for < period_start
  ), client_mix as (
    select distinct selected.client_id,
      exists (
        select 1 from public.jobs prior
        where prior.account_id = requested_account_id
          and prior.client_id = selected.client_id
          and prior.scheduled_for < period_start
      ) as is_repeat
    from selected
  )
  select
    requested_account_id,
    (select count(*) from selected),
    (select count(*) from previous),
    case when (select count(*) from previous) = 0 then null
      else round((((select count(*) from selected) - (select count(*) from previous))::numeric / (select count(*) from previous)) * 100)::integer
    end,
    (select count(*) from client_mix where not is_repeat),
    (select count(*) from client_mix where is_repeat);
end;
$$;

revoke all on function public.get_analytics_summary(text, date, date) from public;
grant execute on function public.get_analytics_summary(text, date, date) to authenticated;
