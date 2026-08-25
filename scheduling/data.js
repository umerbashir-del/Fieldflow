import sharedAccounts from '../shared-data/accounts.json';
import sharedClients from '../shared-data/clients.json';
import sharedJobs from '../shared-data/jobs.json';
import { isMockContractor, mockUserFromSearch } from '../shared-data/mockSession.js';
import { getAccountData, getSignedInAccount, isSupabaseConfigured } from '../shared-data/supabase.js';

const mockUser = mockUserFromSearch(window.location.search);
let liveContext = null;
let liveData = { clients: [], jobs: [] };

if (isSupabaseConfigured) {
  liveContext = await getSignedInAccount();
  if (liveContext?.account) liveData = await getAccountData(liveContext.account.id);
}

// Static synthetic seedClients (with the split-address fields) is no
// longer needed here — shared-data/clients.json already carries those
// same fields (building_number/street_name/city/state/zip_code/
// client_phone, see docs/data-model.md) and is now the actual source,
// filtered by account below.
export const LIVE_MODE = isSupabaseConfigured;
export const IS_CONTRACTOR_SESSION = isSupabaseConfigured ? Boolean(liveContext?.account) : isMockContractor(mockUser);
export const ACCOUNT_ID = isSupabaseConfigured ? liveContext?.account?.id ?? null : (IS_CONTRACTOR_SESSION ? mockUser.account_id : null);

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
