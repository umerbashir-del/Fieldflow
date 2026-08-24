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

const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const { error: signInError } = await client.auth.signInWithPassword({
  email: env.SARAH_TEST_EMAIL,
  password: env.SARAH_TEST_PASSWORD,
});
if (signInError) throw signInError;

const { data, error } = await client
  .from('account_memberships')
  .select('account_id, role, accounts(name)')
  .single();
if (error) throw error;
if (data.account_id !== 'acct_horizon' || data.role !== 'owner') {
  throw new Error('Sarah is not assigned to Horizon as owner.');
}

console.log(`Sarah login verified: ${data.accounts.name}, ${data.role}.`);
await client.auth.signOut();
