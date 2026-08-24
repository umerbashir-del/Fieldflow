import sharedAccounts from '../shared-data/accounts.json';
import sharedClients from '../shared-data/clients.json';
import sharedJobs from '../shared-data/jobs.json';
import { isMockContractor, mockUserFromSearch } from '../shared-data/mockSession.js';

const mockUser = mockUserFromSearch(window.location.search);

export const IS_CONTRACTOR_SESSION = isMockContractor(mockUser);
export const ACCOUNT_ID = IS_CONTRACTOR_SESSION ? mockUser.account_id : null;

export const accounts = mockUser?.company_name && !sharedAccounts.some((account) => account.id === mockUser.account_id)
  ? [...sharedAccounts, { id: mockUser.account_id, name: mockUser.company_name, plan: 'Starter' }]
  : sharedAccounts;

export const seedClients = ACCOUNT_ID ? sharedClients.filter((client) => client.account_id === ACCOUNT_ID) : [];

export const seedJobs = ACCOUNT_ID ? sharedJobs.filter((job) => job.account_id === ACCOUNT_ID) : [];

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
