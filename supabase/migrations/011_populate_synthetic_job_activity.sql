insert into public.job_activity (id, account_id, job_id, activity_type, occurred_at, detail)
select 'act_' || id || '_scheduled', account_id, id, 'scheduled', scheduled_for::timestamptz - interval '6 days' + interval '9 hours', 'Job scheduled' from public.jobs
where account_id in ('acct_brightspark', 'acct_clearview', 'acct_coastal', 'acct_greenscape', 'acct_horizon', 'acct_ironclad', 'acct_northstar', 'acct_riverstone', 'acct_summitpaint', 'acct_truenorth') on conflict (id) do nothing;
insert into public.job_activity (id, account_id, job_id, activity_type, occurred_at, detail)
select 'act_' || id || '_completed', account_id, id, 'completed', coalesce(completed_at, scheduled_for::timestamptz + interval '17 hours'), 'Job marked completed' from public.jobs
where account_id in ('acct_brightspark', 'acct_clearview', 'acct_coastal', 'acct_greenscape', 'acct_horizon', 'acct_ironclad', 'acct_northstar', 'acct_riverstone', 'acct_summitpaint', 'acct_truenorth') and status = 'completed' on conflict (id) do nothing;
insert into public.job_activity (id, account_id, job_id, activity_type, occurred_at, detail)
select 'act_' || id || '_cancelled', account_id, id, 'cancelled', scheduled_for::timestamptz + interval '12 hours', 'Job cancelled' from public.jobs
where account_id in ('acct_brightspark', 'acct_clearview', 'acct_coastal', 'acct_greenscape', 'acct_horizon', 'acct_ironclad', 'acct_northstar', 'acct_riverstone', 'acct_summitpaint', 'acct_truenorth') and status = 'cancelled' on conflict (id) do nothing;
