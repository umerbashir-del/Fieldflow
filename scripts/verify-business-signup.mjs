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

const admin = createClient(
  env.VITE_SUPABASE_URL,
  env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);
const stamp = Date.now();
const companyName = `FieldFlow Signup Verification ${stamp}`;
const createdUsers = [];
const createdAccounts = [];

async function createBusinessUser(index) {
  const { data, error } = await admin.auth.admin.createUser({
    email: `fieldflow-signup-${stamp}-${index}@example.com`,
    password: `Temporary-${crypto.randomUUID()}!`,
    email_confirm: true,
    user_metadata: {
      signup_type: 'fieldflow_business',
      owner_name: `Verification Owner ${index}`,
      company_name: companyName,
      account_id: 'acct_northstar',
    },
  });
  if (error) throw error;
  createdUsers.push(data.user.id);

  const { data: membership, error: membershipError } = await admin
    .from('account_memberships')
    .select('account_id, role, accounts(name, plan)')
    .eq('user_id', data.user.id)
    .single();
  if (membershipError) throw membershipError;
  createdAccounts.push(membership.account_id);
  if (membership.role !== 'owner' || membership.accounts.name !== companyName || membership.accounts.plan !== 'Starter') {
    throw new Error('Business signup did not create the expected Starter owner membership.');
  }
  if (membership.account_id === 'acct_northstar') throw new Error('Business signup trusted a browser-supplied account ID.');

  const [{ count: clientCount, error: clientError }, { count: jobCount, error: jobError }] = await Promise.all([
    admin.from('clients').select('id', { count: 'exact', head: true }).eq('account_id', membership.account_id),
    admin.from('jobs').select('id', { count: 'exact', head: true }).eq('account_id', membership.account_id),
  ]);
  if (clientError || jobError) throw clientError || jobError;
  if (clientCount !== 0 || jobCount !== 0) throw new Error('New business inherited existing clients or jobs.');
}

try {
  await createBusinessUser(1);
  await createBusinessUser(2);
  if (createdAccounts[0] === createdAccounts[1]) throw new Error('Two signups received the same account ID.');
  console.log('Business signup verified: unique account IDs, owner memberships, empty data, and no trusted browser account ID.');
} finally {
  for (const accountId of createdAccounts) {
    const { error } = await admin.from('accounts').delete().eq('id', accountId);
    if (error) console.error(`Warning: could not remove temporary account ${accountId}: ${error.message}`);
  }
  for (const userId of createdUsers) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) console.error(`Warning: could not remove temporary user ${userId}: ${error.message}`);
  }
}
