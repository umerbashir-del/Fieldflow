import { isMockContractor, mockUserFromSearch } from '../shared-data/mockSession.js';
import { getAccountData, getSignedInAccount, isSupabaseConfigured } from '../shared-data/supabase.js';
import { reportingDateFromAccount } from '../shared-data/reportingDate.js';

const [sharedAccounts, sharedClients, sharedJobs] = __FIELDFLOW_DEMO__
  ? await Promise.all([
      import('../shared-data/accounts.json').then((module) => module.default),
      import('../shared-data/clients.json').then((module) => module.default),
      import('../shared-data/jobs.json').then((module) => module.default),
    ])
  : [[], [], []];

const mockUser = mockUserFromSearch(window.location.search);
export const LIVE_MODE = isSupabaseConfigured;
const demoSession = isMockContractor(mockUser);
const demoAccountId = demoSession ? mockUser.account_id : null;
const demoAccount = sharedAccounts.find((account) => account.id === demoAccountId) ?? null;

export let LIVE_LOAD_ERROR = '';
export let IS_CONTRACTOR_SESSION = LIVE_MODE ? false : demoSession;
export let ACCOUNT_ID = LIVE_MODE ? null : demoAccountId;
export let ACTIVE_ACCOUNT = LIVE_MODE ? null : demoAccount;
export let REPORTING = LIVE_MODE
  ? reportingDateFromAccount(null, window.location.search)
  : reportingDateFromAccount({ demo_reporting_date: '2026-08-19' }, window.location.search);
export let accounts = LIVE_MODE
  ? []
  : mockUser?.company_name && !sharedAccounts.some((account) => account.id === mockUser.account_id)
  ? [...sharedAccounts, { id: mockUser.account_id, name: mockUser.company_name, plan: 'Starter' }]
  : sharedAccounts;
export let seedClients = LIVE_MODE ? [] : (ACCOUNT_ID ? sharedClients.filter((client) => client.account_id === ACCOUNT_ID) : []);
export let seedJobs = LIVE_MODE ? [] : (ACCOUNT_ID ? sharedJobs.filter((job) => job.account_id === ACCOUNT_ID) : []);

let liveContextPromise = null;
let liveDataPromise = null;

// The account is needed before Scheduling can open, but jobs and clients
// are deliberately loaded later so users see the app shell immediately.
export function loadSchedulingSession() {
  if (!LIVE_MODE) return Promise.resolve({ account: ACTIVE_ACCOUNT, user: mockUser });
  if (!liveContextPromise) {
    liveContextPromise = getSignedInAccount().then((context) => {
      IS_CONTRACTOR_SESSION = Boolean(context?.account);
      ACCOUNT_ID = context?.account?.id ?? null;
      ACTIVE_ACCOUNT = context?.account ?? null;
      REPORTING = reportingDateFromAccount(ACTIVE_ACCOUNT, window.location.search);
      accounts = ACTIVE_ACCOUNT ? [ACTIVE_ACCOUNT] : [];
      return context;
    });
  }
  return liveContextPromise;
}

export function refreshSchedulingSession() {
  liveContextPromise = null;
  liveDataPromise = null;
  LIVE_LOAD_ERROR = '';
  return loadSchedulingSession();
}

export function loadSchedulingData() {
  if (!LIVE_MODE) return Promise.resolve({ clients: seedClients, jobs: seedJobs });
  if (!liveDataPromise) {
    liveDataPromise = loadSchedulingSession()
      .then((context) => context?.account ? getAccountData(context.account.id) : { clients: [], jobs: [] })
      .then((data) => {
        seedClients = data.clients;
        seedJobs = data.jobs;
        return data;
      })
      .catch((error) => {
        LIVE_LOAD_ERROR = 'We couldn’t load your data. Check your connection and try again.';
        throw error;
      });
  }
  return liveDataPromise;
}


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

// Appointment-confirmation tracking (separate from job status — a job can
// be "Scheduled" and still need someone to actually confirm the customer
// will be there). Optional on every job; missing/unrecognized values are
// treated as 'pending' everywhere they're read, so existing jobs that
// predate this field keep working with no migration needed.
export const CONFIRMATION_VALUES = ['pending', 'contacted', 'confirmed', 'no_response', 'reschedule_needed'];
export const CONFIRMATION_LABELS = {
  pending: 'Needs confirmation',
  contacted: 'Contacted — awaiting reply',
  confirmed: 'Confirmed',
  no_response: 'No response',
  reschedule_needed: 'Reschedule needed',
};
export const CONTACT_METHODS = ['phone', 'text', 'email'];
export const CONTACT_METHOD_LABELS = { phone: 'Phone', text: 'Text', email: 'Email' };
