import { randomBytes } from 'node:crypto';
import { appendFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(root, '.env');
let envText = await readFile(envPath, 'utf8');
const env = Object.fromEntries(
  envText.split(/\r?\n/)
    .map((line) => line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/))
    .filter(Boolean)
    .map((match) => [match[1], match[2].replace(/^['"]|['"]$/g, '')]),
);

const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Supabase server credentials are not configured in .env.');

const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const { data: listed, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (listError) throw listError;

async function getOrCreateUser({ email, emailVariable, passwordVariable }) {
  let user = listed.users.find((candidate) => candidate.email?.toLowerCase() === email);
  if (user) return { user, created: false };
  if (new RegExp(`^${passwordVariable}=`, 'm').test(envText)) {
    throw new Error(`${passwordVariable} already exists in .env; refusing to create different credentials.`);
  }
  const password = `${randomBytes(18).toString('base64url')}aA7!`;
  const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const addition = `\n${emailVariable}=${email}\n${passwordVariable}=${password}\n`;
  await appendFile(envPath, addition, 'utf8');
  envText += addition;
  return { user: data.user, created: true };
}

const john = await getOrCreateUser({
  email: 'john@fieldflow.demo',
  emailVariable: 'JOHN_TEST_EMAIL',
  passwordVariable: 'JOHN_TEST_PASSWORD',
});
const { error: johnMembershipError } = await supabase
  .from('account_memberships')
  .upsert({ account_id: 'acct_northstar', user_id: john.user.id, role: 'owner' }, { onConflict: 'account_id,user_id' });
if (johnMembershipError) throw johnMembershipError;

const operations = await getOrCreateUser({
  email: 'operations@fieldflow.demo',
  emailVariable: 'OPERATIONS_TEST_EMAIL',
  passwordVariable: 'OPERATIONS_TEST_PASSWORD',
});
const { error: staffError } = await supabase
  .from('operations_staff')
  .upsert({ user_id: operations.user.id }, { onConflict: 'user_id' });
if (staffError) throw staffError;

console.log(`${john.created ? 'Created' : 'Found'} John's test user and assigned it to Northstar as owner.`);
console.log(`${operations.created ? 'Created' : 'Found'} the Operations test user and granted staff access.`);
if (john.created || operations.created) console.log('New temporary credentials were saved privately in .env.');
