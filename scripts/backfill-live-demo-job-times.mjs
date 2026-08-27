import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function loadLocalEnv() {
  try {
    const contents = await readFile(path.join(root, '.env'), 'utf8');
    for (const line of contents.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

await loadLocalEnv();
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const password = process.env.VITE_JOHN_TEST_PASSWORD;
if (!url || !key || !password) throw new Error('Set VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, and VITE_JOHN_TEST_PASSWORD in .env.');

const client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const { data: authData, error: authError } = await client.auth.signInWithPassword({
  email: 'john@fieldflow.demo',
  password,
});
if (authError) throw authError;

const { data: membership, error: membershipError } = await client
  .from('account_memberships')
  .select('account_id')
  .eq('user_id', authData.user.id)
  .limit(1)
  .maybeSingle();
if (membershipError) throw membershipError;
if (!membership?.account_id) throw new Error('The demo contractor is not assigned to an account.');

const jobs = JSON.parse(await readFile(path.join(root, 'shared-data', 'jobs.json'), 'utf8'));
const expectedTimes = new Map(jobs
  .filter((job) => job.account_id === membership.account_id)
  .map((job) => [job.id, job.scheduled_start_time]));
const { data: liveJobs, error: jobsError } = await client
  .from('jobs')
  .select('id, scheduled_start_time')
  .eq('account_id', membership.account_id);
if (jobsError) throw jobsError;

const updates = liveJobs.filter((job) => !job.scheduled_start_time && expectedTimes.has(job.id));
for (const job of updates) {
  const { error } = await client
    .from('jobs')
    .update({ scheduled_start_time: expectedTimes.get(job.id) })
    .eq('id', job.id)
    .eq('account_id', membership.account_id);
  if (error) throw error;
}

await client.auth.signOut();
console.log(`Filled start times for ${updates.length} ${membership.account_id} jobs; existing times were preserved.`);
