-- Pick a representative active week for each synthetic company. This keeps
-- the demo deterministic while allowing each account's real job history to
-- drive Scheduling, Analytics, Chatbot, and Operations.
update public.accounts
set demo_reporting_date = case id
  when 'acct_brightspark' then date '2026-06-02'
  when 'acct_clearview' then date '2026-03-10'
  when 'acct_coastal' then date '2026-09-28'
  when 'acct_greenscape' then date '2026-09-25'
  when 'acct_horizon' then date '2026-08-19'
  when 'acct_ironclad' then date '2026-06-11'
  when 'acct_northstar' then date '2026-08-19'
  when 'acct_riverstone' then date '2026-08-19'
  when 'acct_summitpaint' then date '2026-08-30'
  when 'acct_truenorth' then date '2026-01-16'
  else demo_reporting_date
end
where id in (
  'acct_brightspark', 'acct_clearview', 'acct_coastal', 'acct_greenscape',
  'acct_horizon', 'acct_ironclad', 'acct_northstar', 'acct_riverstone',
  'acct_summitpaint', 'acct_truenorth'
);
