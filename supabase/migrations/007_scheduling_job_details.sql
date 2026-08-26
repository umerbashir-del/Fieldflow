-- Optional Scheduling details. Existing jobs remain valid and gain null values
-- until a dispatcher records a time or appointment-contact detail.

alter table public.jobs
  add column if not exists scheduled_start_time time,
  add column if not exists appointment_confirmation_status text not null default 'pending'
    check (appointment_confirmation_status in ('pending', 'contacted', 'confirmed', 'no_response', 'reschedule_needed')),
  add column if not exists contact_method text
    check (contact_method in ('phone', 'text', 'email')),
  add column if not exists confirmed_by text,
  add column if not exists confirmation_note text,
  add column if not exists last_contacted_at date,
  add column if not exists confirmed_at date;

create index if not exists jobs_account_confirmation_idx
  on public.jobs (account_id, appointment_confirmation_status, scheduled_for);
