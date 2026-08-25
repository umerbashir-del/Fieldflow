import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = async (name) => JSON.parse(await readFile(path.join(root, 'shared-data', name), 'utf8'));

const [canonicalJobs, syntheticRows, clients] = await Promise.all([
  readJson('jobs.json'),
  readJson('synthetic-dataset.json'),
  readJson('clients.json'),
]);

const representedAccounts = new Set(canonicalJobs.map((job) => job.account_id));
const clientKeys = new Set(clients.map((client) => `${client.account_id}:${client.id}`));
const allowedStatuses = new Map([
  ['Scheduled', 'scheduled'],
  ['Completed', 'completed'],
  ['Cancelled', 'cancelled'],
]);
const seenIds = new Set(canonicalJobs.map((job) => job.id));
const additions = [];

for (const row of syntheticRows) {
  if (representedAccounts.has(row.customer_id)) continue;
  const status = allowedStatuses.get(row.job_status);
  if (!status || seenIds.has(row.job_id)) continue;
  if (!clientKeys.has(`${row.customer_id}:${row.client_id}`)) {
    throw new Error(`Synthetic job ${row.job_id} references a client outside ${row.customer_id}.`);
  }
  seenIds.add(row.job_id);
  additions.push({
    id: row.job_id,
    account_id: row.customer_id,
    client_id: row.client_id,
    title: `${row.client_name} service visit`,
    scheduled_for: row.job_date,
    status,
    assignee: null,
  });
}

const merged = [...canonicalJobs, ...additions].sort((a, b) =>
  a.account_id.localeCompare(b.account_id) || a.scheduled_for.localeCompare(b.scheduled_for) || a.id.localeCompare(b.id));
await writeFile(path.join(root, 'shared-data', 'jobs.json'), `${JSON.stringify(merged, null, 2)}\n`);
console.log(`Added ${additions.length} valid jobs for previously empty accounts; canonical total is ${merged.length}.`);
