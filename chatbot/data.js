// Live shared data on purpose.
//
// Scheduling keeps a local mock copy of shared-data (see its data.js) so it
// stays a double-clickable, no-server file. Chat Box doesn't have that
// constraint — it only ever runs through the Vite dev server — and account
// lookup only means something if it's checking real multi-account data, so
// this imports straight from shared-data/ and docs/ instead of mocking them.
import { formatDate, clientName } from '../shared-data/formatters.js';

const [accounts, clients, jobs] = __FIELDFLOW_DEMO__
  ? await Promise.all([
      import('../shared-data/accounts.json').then((module) => module.default),
      import('../shared-data/clients.json').then((module) => module.default),
      import('../shared-data/jobs.json').then((module) => module.default),
    ])
  : [[], [], []];

import apiContractDoc from '../docs/api-contract.md?raw';
import dataModelDoc from '../docs/data-model.md?raw';
import standardsDoc from '../docs/standards.md?raw';

export { accounts, clients, jobs, formatDate, clientName };

export const docs = [
  { id: 'api-contract', title: 'api-contract.md', text: apiContractDoc },
  { id: 'data-model', title: 'data-model.md', text: dataModelDoc },
  { id: 'standards', title: 'standards.md', text: standardsDoc },
];
