// Local mock data for the Scheduling area.
//
// Shaped to match the team's real shared-data files field-for-field
// (shared-data/accounts.json, clients.json, jobs.json), so wiring this
// up to the real shared data later is a source swap, not a rewrite —
// see the notes in scheduling.js at the top of the "DATA ACCESS" section.
//
// This module is served through Vite. That lets the production build include
// its data and makes its dependencies explicit.

export const ACCOUNT_ID = 'acct_northstar';

export const accounts = [
  { id: 'acct_northstar', name: 'Northstar Field Services', plan: 'Growth' },
];

export const seedClients = [
  { id: 'client_evergreen', account_id: 'acct_northstar', name: 'Evergreen Properties', city: 'Raleigh' },
  { id: 'client_harbor', account_id: 'acct_northstar', name: 'Harbor Dental Group', city: 'Durham' },
  { id: 'client_summit', account_id: 'acct_northstar', name: 'Summit Retail', city: 'Cary' },
  { id: 'client_pinecrest', account_id: 'acct_northstar', name: 'Pinecrest Apartments', city: 'Chapel Hill' },
];

export const seedJobs = [
  { id: 'job_101', account_id: 'acct_northstar', client_id: 'client_evergreen', title: 'HVAC inspection', scheduled_for: '2026-08-20', status: 'scheduled', assignee: 'Maya Chen' },
  { id: 'job_102', account_id: 'acct_northstar', client_id: 'client_harbor', title: 'Equipment calibration', scheduled_for: '2026-08-20', status: 'in_progress', assignee: 'Jordan Lee' },
  { id: 'job_103', account_id: 'acct_northstar', client_id: 'client_summit', title: 'Safety follow-up', scheduled_for: '2026-08-22', status: 'scheduled', assignee: 'Maya Chen' },
  { id: 'job_104', account_id: 'acct_northstar', client_id: 'client_evergreen', title: 'Filter replacement', scheduled_for: '2026-08-17', status: 'completed', assignee: 'Jordan Lee' },
  { id: 'job_105', account_id: 'acct_northstar', client_id: 'client_pinecrest', title: 'Water heater check', scheduled_for: '2026-08-20', status: 'scheduled', assignee: 'Maya Chen' },
];

// Not part of the real shared schema yet — local-only helper lists for
// the UI's assignee/status pickers.
export const TEAM_MEMBERS = ['Maya Chen', 'Jordan Lee', 'Priya Patel'];
export const STATUS_VALUES = ['scheduled', 'in_progress', 'completed', 'cancelled'];
export const STATUS_LABELS = {
  scheduled: 'Scheduled',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};
