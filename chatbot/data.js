// Live shared data on purpose.
//
// Scheduling keeps a local mock copy of shared-data (see its data.js) so it
// stays a double-clickable, no-server file. Chat Box doesn't have that
// constraint — it only ever runs through the Vite dev server — and account
// lookup only means something if it's checking real multi-account data, so
// this imports straight from shared-data/ and docs/ instead of mocking them.
import accounts from '../shared-data/accounts.json';
import clients from '../shared-data/clients.json';
import jobs from '../shared-data/jobs.json';
import { formatDate, clientName } from '../shared-data/formatters.js';

import apiContractDoc from '../docs/api-contract.md?raw';
import dataModelDoc from '../docs/data-model.md?raw';
import standardsDoc from '../docs/standards.md?raw';

export { accounts, clients, jobs, formatDate, clientName };

export const docs = [
  { id: 'api-contract', title: 'api-contract.md', text: apiContractDoc },
  { id: 'data-model', title: 'data-model.md', text: dataModelDoc },
  { id: 'standards', title: 'standards.md', text: standardsDoc },
];
