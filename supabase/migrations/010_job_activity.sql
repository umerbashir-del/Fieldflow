create table public.job_activity (
  id text primary key,
  account_id text not null references public.accounts(id) on delete cascade,
  job_id text not null references public.jobs(id) on delete cascade,
  activity_type text not null check (activity_type in ('scheduled', 'completed', 'cancelled', 'updated', 'confirmation')),
  occurred_at timestamptz not null default now(),
  detail text not null
);
create index job_activity_account_occurred_idx on public.job_activity (account_id, occurred_at desc);
alter table public.job_activity enable row level security;
create policy "Members can read account job activity" on public.job_activity for select to authenticated using (public.is_account_member(account_id) or public.is_operations_staff());
create policy "Members can create account job activity" on public.job_activity for insert to authenticated with check (public.is_account_member(account_id));

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'job_activity') then
    alter publication supabase_realtime add table public.job_activity;
  end if;
end;
$$;
