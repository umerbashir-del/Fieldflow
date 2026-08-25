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
const publicKey = env.VITE_SUPABASE_PUBLISHABLE_KEY;
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const browserClient = () => createClient(env.VITE_SUPABASE_URL, publicKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const stamp = Date.now();
const email = `fieldflow-auth-edge-${stamp}@example.com`;
const password = `Temporary-${crypto.randomUUID()}!`;
const accountId = `acct_auth_edge_${stamp}`;
let userId;

try {
  const { data: created, error: createUserError } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (createUserError) throw createUserError;
  userId = created.user.id;

  const user = browserClient();
  const { error: signInError } = await user.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  const { data: missingMembership, error: missingMembershipError } = await user.from('account_memberships').select('account_id');
  if (missingMembershipError) throw missingMembershipError;
  if (missingMembership.length) throw new Error('A new unassigned user unexpectedly inherited a company.');
  const { data: missingJobs, error: missingJobsError } = await user.from('jobs').select('id');
  if (missingJobsError) throw missingJobsError;
  if (missingJobs.length) throw new Error('An unassigned user could read customer jobs.');

  const { error: accountError } = await admin.from('accounts').insert({ id: accountId, name: 'Auth Edge Verification', plan: 'Starter' });
  if (accountError) throw accountError;
  const { error: membershipError } = await admin.from('account_memberships').insert({ account_id: accountId, user_id: userId, role: 'owner' });
  if (membershipError) throw membershipError;
  const { data: assigned, error: assignedError } = await user.from('account_memberships').select('account_id').single();
  if (assignedError || assigned.account_id !== accountId) throw assignedError || new Error('Assigned membership was not visible.');

  const { error: removeMembershipError } = await admin.from('account_memberships').delete().eq('user_id', userId);
  if (removeMembershipError) throw removeMembershipError;
  const { data: afterRemoval, error: afterRemovalError } = await user.from('account_memberships').select('account_id');
  if (afterRemovalError) throw afterRemovalError;
  if (afterRemoval.length) throw new Error('Removed membership remained accessible in an active session.');
  const { data: jobsAfterRemoval, error: jobsAfterRemovalError } = await user.from('jobs').select('id');
  if (jobsAfterRemovalError) throw jobsAfterRemovalError;
  if (jobsAfterRemoval.length) throw new Error('Removed membership retained customer-data access.');
  await user.auth.signOut();

  const expired = browserClient();
  const { error: expiredSessionError } = await expired.auth.setSession({
    access_token: 'expired.invalid.token',
    refresh_token: 'invalid-refresh-token',
  });
  if (!expiredSessionError) throw new Error('An invalid expired session was accepted.');

  const invalidKey = createClient(env.VITE_SUPABASE_URL, 'invalid-publishable-key', {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: invalidKeyError } = await invalidKey.from('accounts').select('id').limit(1);
  if (!invalidKeyError) throw new Error('Supabase accepted an invalid publishable key.');

  console.log('Auth edge cases verified: missing membership, membership removal, expired session, and invalid API key.');
} finally {
  if (accountId) await admin.from('accounts').delete().eq('id', accountId);
  if (userId) await admin.auth.admin.deleteUser(userId);
}
