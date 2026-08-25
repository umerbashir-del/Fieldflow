import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = Object.fromEntries(
  (await readFile(path.join(root, '.env'), 'utf8'))
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/))
    .filter(Boolean)
    .map((match) => [match[1], match[2].replace(/^['"]|['"]$/g, '')]),
);

const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Supabase server credentials are not configured in .env.');

const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
for (const table of ['accounts', 'clients', 'jobs']) {
  const { count, error } = await supabase.from(table).select('id', { count: 'exact', head: true });
  if (error) throw new Error(`${table}: ${error.message}`);
  console.log(`${table}: ${count}`);
}

const demoAccounts = JSON.parse(await readFile(path.join(root, 'shared-data', 'accounts.json'), 'utf8'));
const [{ data: liveAccounts, error: accountError }, { data: liveJobs, error: jobError }] = await Promise.all([
  supabase.from('accounts').select('id, demo_reporting_date').in('id', demoAccounts.map((account) => account.id)),
  supabase.from('jobs').select('id, account_id, client_id, status'),
]);
if (accountError) throw new Error(`demo account configuration: ${accountError.message}`);
if (jobError) throw new Error(`job validation: ${jobError.message}`);

const validStatuses = new Set(['scheduled', 'in_progress', 'completed', 'cancelled']);
for (const account of demoAccounts) {
  const configured = liveAccounts.find((item) => item.id === account.id);
  if (!configured?.demo_reporting_date) throw new Error(`${account.id} has no demo reporting date.`);
  if (!liveJobs.some((job) => job.account_id === account.id)) throw new Error(`${account.id} has no jobs.`);
}
if (new Set(liveJobs.map((job) => job.id)).size !== liveJobs.length) throw new Error('Live jobs contain duplicate IDs.');
if (liveJobs.some((job) => !validStatuses.has(job.status))) throw new Error('Live jobs contain a non-canonical status.');
console.log('Demo coverage: every canonical company has jobs and a reporting date.');
