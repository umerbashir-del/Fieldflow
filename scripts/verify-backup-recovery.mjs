import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envText = await readFile(path.join(root, '.env'), 'utf8');
const env = Object.fromEntries(
  envText.split(/\r?\n/)
    .map((line) => line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/))
    .filter(Boolean)
    .map((match) => [match[1], match[2].replace(/^['"]|['"]$/g, '')]),
);
const admin = createClient(
  env.VITE_SUPABASE_URL,
  env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const results = await Promise.all(['accounts', 'clients', 'jobs'].map((table) => admin.from(table).select('*')));
const error = results.find((result) => result.error)?.error;
if (error) throw error;
const backup = Object.fromEntries(['accounts', 'clients', 'jobs'].map((table, index) => [table, results[index].data]));
const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'fieldflow-backup-test-'));

try {
  const backupPath = path.join(temporaryDirectory, 'fieldflow-backup.json');
  await writeFile(backupPath, JSON.stringify(backup), 'utf8');
  const restored = JSON.parse(await readFile(backupPath, 'utf8'));
  for (const table of ['accounts', 'clients', 'jobs']) {
    if (restored[table].length !== backup[table].length) throw new Error(`${table} backup count changed during recovery.`);
    if (new Set(restored[table].map((row) => row.id)).size !== restored[table].length) throw new Error(`${table} recovery contains duplicate IDs.`);
  }
  const accountIds = new Set(restored.accounts.map((account) => account.id));
  const clientKeys = new Set(restored.clients.map((client) => `${client.account_id}:${client.id}`));
  if (restored.clients.some((client) => !accountIds.has(client.account_id))) throw new Error('Recovered client references a missing account.');
  if (restored.jobs.some((job) => !accountIds.has(job.account_id) || !clientKeys.has(`${job.account_id}:${job.client_id}`))) {
    throw new Error('Recovered job references a missing account or client.');
  }
  console.log(`Backup recovery verified: ${restored.accounts.length} accounts, ${restored.clients.length} clients, ${restored.jobs.length} jobs.`);
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
