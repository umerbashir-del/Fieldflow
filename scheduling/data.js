// Local mock data for the Scheduling area.
//
// Shaped to match the team's real shared-data files field-for-field
// (shared-data/accounts.json, clients.json, jobs.json), so wiring this
// up to the real shared data later is a source swap, not a rewrite —
// see the notes in scheduling.js at the top of the "DATA ACCESS" section.
//
// Plain scripts on purpose (no ES modules): this file is meant to be
// double-clicked and opened straight from the filesystem, and browsers
// block `type="module"` script fetches over file:// with a CORS error.
// Regular <script src> tags don't have that restriction, and values
// declared here with const/let are visible to the scripts loaded after
// this one in scheduling.html.

const ACCOUNT_ID = 'acct_northstar';

const accounts = [
  { id: 'acct_northstar', name: 'Northstar Field Services', plan: 'Growth' },
];

// Shape matches docs/data-model.md as of the synthetic-dataset merge:
// address is split into building_number/street_name/city/state/zip_code
// (not one free-text field) so scheduling/dispatch can sort/validate on
// it, plus client_phone for appointment communication.
const seedClients = [
  { id: 'client_evergreen', account_id: 'acct_northstar', name: 'Evergreen Properties', building_number: '482', street_name: 'Glenwood Ave', city: 'Raleigh', state: 'NC', zip_code: '27603', client_phone: '(919) 555-0142' },
  { id: 'client_harbor', account_id: 'acct_northstar', name: 'Harbor Dental Group', building_number: '117', street_name: 'W Main St', city: 'Durham', state: 'NC', zip_code: '27701', client_phone: '(919) 555-0187' },
  { id: 'client_summit', account_id: 'acct_northstar', name: 'Summit Retail', building_number: '305', street_name: 'S Academy St', city: 'Cary', state: 'NC', zip_code: '27511', client_phone: '(919) 555-0163' },
  { id: 'client_pinecrest', account_id: 'acct_northstar', name: 'Pinecrest Apartments', building_number: '920', street_name: 'Franklin St', city: 'Chapel Hill', state: 'NC', zip_code: '27514', client_phone: '(919) 555-0129' },
];

const seedJobs = [
  { id: 'job_101', account_id: 'acct_northstar', client_id: 'client_evergreen', title: 'HVAC inspection', scheduled_for: '2026-08-20', status: 'scheduled', assignee: 'Maya Chen' },
  { id: 'job_102', account_id: 'acct_northstar', client_id: 'client_harbor', title: 'Equipment calibration', scheduled_for: '2026-08-20', status: 'in_progress', assignee: 'Jordan Lee' },
  { id: 'job_103', account_id: 'acct_northstar', client_id: 'client_summit', title: 'Safety follow-up', scheduled_for: '2026-08-22', status: 'scheduled', assignee: 'Maya Chen' },
  { id: 'job_104', account_id: 'acct_northstar', client_id: 'client_evergreen', title: 'Filter replacement', scheduled_for: '2026-08-17', status: 'completed', assignee: 'Jordan Lee' },
  { id: 'job_105', account_id: 'acct_northstar', client_id: 'client_pinecrest', title: 'Water heater check', scheduled_for: '2026-08-20', status: 'scheduled', assignee: 'Maya Chen' },
];

// Not part of the real shared schema yet — local-only helper lists for
// the UI's assignee/status pickers.
const TEAM_MEMBERS = ['Maya Chen', 'Jordan Lee', 'Priya Patel'];
const STATUS_VALUES = ['scheduled', 'in_progress', 'completed', 'cancelled'];
const STATUS_LABELS = {
  scheduled: 'Scheduled',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};
