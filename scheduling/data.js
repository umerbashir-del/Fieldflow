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
let liveContext = null;
let liveData = { clients: [], jobs: [] };
export let LIVE_LOAD_ERROR = '';

if (isSupabaseConfigured) {
  try {
    liveContext = await getSignedInAccount();
    if (liveContext?.account) liveData = await getAccountData(liveContext.account.id);
  } catch (error) {
    LIVE_LOAD_ERROR = 'We couldn’t load your data. Check your connection and try again.';
  }
}

export const LIVE_MODE = isSupabaseConfigured;
export const IS_CONTRACTOR_SESSION = isSupabaseConfigured ? Boolean(liveContext?.account) : isMockContractor(mockUser);
export const ACCOUNT_ID = isSupabaseConfigured ? liveContext?.account?.id ?? null : (IS_CONTRACTOR_SESSION ? mockUser.account_id : null);
export const ACTIVE_ACCOUNT = isSupabaseConfigured ? liveContext?.account ?? null : sharedAccounts.find((account) => account.id === ACCOUNT_ID) ?? null;
export const REPORTING = isSupabaseConfigured
  ? reportingDateFromAccount(ACTIVE_ACCOUNT, window.location.search)
  : reportingDateFromAccount({ demo_reporting_date: '2026-08-19' }, window.location.search);

export const accounts = isSupabaseConfigured
  ? (liveContext?.account ? [liveContext.account] : [])
  : mockUser?.company_name && !sharedAccounts.some((account) => account.id === mockUser.account_id)
  ? [...sharedAccounts, { id: mockUser.account_id, name: mockUser.company_name, plan: 'Starter' }]
  : sharedAccounts;

export const seedClients = isSupabaseConfigured ? liveData.clients : (ACCOUNT_ID ? sharedClients.filter((client) => client.account_id === ACCOUNT_ID) : []);

export const seedJobs = isSupabaseConfigured ? liveData.jobs : (ACCOUNT_ID ? sharedJobs.filter((job) => job.account_id === ACCOUNT_ID) : []);

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
