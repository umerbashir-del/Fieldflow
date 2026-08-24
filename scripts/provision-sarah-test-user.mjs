import { randomBytes } from 'node:crypto';
import { appendFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(root, '.env');
const envText = await readFile(envPath, 'utf8');
const env = Object.fromEntries(
  envText
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/))
    .filter(Boolean)
    .map((match) => [match[1], match[2].replace(/^['"]|['"]$/g, '')]),
);

const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Supabase server credentials are not configured in .env.');

const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const email = 'sarah@fieldflow.demo';
const accountId = 'acct_horizon';

const { data: listed, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (listError) throw listError;
let user = listed.users.find((candidate) => candidate.email?.toLowerCase() === email);
let created = false;

if (!user) {
  if (/^SARAH_TEST_PASSWORD=/m.test(envText)) {
    throw new Error('SARAH_TEST_PASSWORD already exists in .env; refusing to create a user with different credentials.');
  }
  const password = `${randomBytes(18).toString('base64url')}aA7!`;
  const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  user = data.user;
  created = true;
  await appendFile(envPath, `\nSARAH_TEST_EMAIL=${email}\nSARAH_TEST_PASSWORD=${password}\n`, 'utf8');
}

const { error: membershipError } = await supabase
  .from('account_memberships')
  .upsert({ account_id: accountId, user_id: user.id, role: 'owner' }, { onConflict: 'account_id,user_id' });
if (membershipError) throw membershipError;

console.log(`${created ? 'Created' : 'Found'} Sarah's test user and assigned it to Horizon as owner.`);
console.log(created ? 'Temporary credentials were saved privately in .env.' : 'The existing user password was not changed.');
