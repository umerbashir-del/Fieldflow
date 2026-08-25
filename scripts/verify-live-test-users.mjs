import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = Object.fromEntries(
  (await readFile(path.join(root, '.env'), 'utf8')).split(/\r?\n/)
    .map((line) => line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/))
    .filter(Boolean)
    .map((match) => [match[1], match[2].replace(/^['"]|['"]$/g, '')]),
);

function browserClient() {
  return createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const john = browserClient();
const { error: johnSignInError } = await john.auth.signInWithPassword({ email: env.JOHN_TEST_EMAIL, password: env.JOHN_TEST_PASSWORD });
if (johnSignInError) throw johnSignInError;
const { data: johnMembership, error: johnMembershipError } = await john.from('account_memberships').select('account_id, role').single();
if (johnMembershipError) throw johnMembershipError;
if (johnMembership.account_id !== 'acct_northstar' || johnMembership.role !== 'owner') throw new Error('John has the wrong membership.');
const { data: leakedHorizon, error: horizonError } = await john.from('jobs').select('id').eq('account_id', 'acct_horizon');
if (horizonError) throw horizonError;
if (leakedHorizon.length) throw new Error('RLS failure: John can read Horizon jobs.');
await john.auth.signOut();

const operations = browserClient();
const { error: opsSignInError } = await operations.auth.signInWithPassword({ email: env.OPERATIONS_TEST_EMAIL, password: env.OPERATIONS_TEST_PASSWORD });
if (opsSignInError) throw opsSignInError;
const { data: staff, error: staffError } = await operations.from('operations_staff').select('user_id').single();
if (staffError || !staff) throw staffError || new Error('Operations staff record is missing.');
const { count: accountCount, error: accountsError } = await operations.from('accounts').select('id', { count: 'exact', head: true });
if (accountsError) throw accountsError;
if (accountCount !== 10) throw new Error(`Operations expected 10 accounts but read ${accountCount}.`);
const { error: forbiddenWriteError } = await operations.from('clients').insert({ id: 'client_ops_write_probe', account_id: 'acct_northstar', name: 'Forbidden write probe' });
if (!forbiddenWriteError) throw new Error('RLS failure: Operations was allowed to create customer data.');
await operations.auth.signOut();

console.log('John verified: Northstar owner; Horizon jobs hidden.');
console.log('Operations verified: 10 accounts readable; customer-data writes blocked.');
