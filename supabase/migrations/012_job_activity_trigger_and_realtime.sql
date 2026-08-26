-- Keep the activity feed accurate even when jobs are changed outside the
-- Scheduling screen, and publish all Analytics-relevant changes to Realtime.

create or replace function public.log_job_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  event_type text;
  event_detail text;
begin
  if tg_op = 'INSERT' then
    event_type := 'scheduled';
    event_detail := 'Job created';
  elsif new.status is distinct from old.status then
    event_type := case when new.status in ('completed', 'cancelled') then new.status else 'updated' end;
    event_detail := case new.status
      when 'completed' then 'Job marked completed'
      when 'cancelled' then 'Job cancelled'
      when 'in_progress' then 'Job marked in progress'
      else 'Job marked scheduled'
    end;
  elsif new.scheduled_for is distinct from old.scheduled_for then
    event_type := 'updated';
    event_detail := 'Job rescheduled';
  elsif new.assignee is distinct from old.assignee then
    event_type := 'updated';
    event_detail := 'Job assignment updated';
  else
    event_type := 'updated';
    event_detail := 'Job updated';
  end if;

  insert into public.job_activity (id, account_id, job_id, activity_type, occurred_at, detail)
  values ('act_live_' || gen_random_uuid()::text, new.account_id, new.id, event_type, now(), event_detail);
  return new;
end;
$$;

drop trigger if exists jobs_log_activity on public.jobs;
create trigger jobs_log_activity
after insert or update on public.jobs
for each row execute function public.log_job_activity();

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'jobs') then
      alter publication supabase_realtime add table public.jobs;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'clients') then
      alter publication supabase_realtime add table public.clients;
    end if;
  end if;
end;
$$;
