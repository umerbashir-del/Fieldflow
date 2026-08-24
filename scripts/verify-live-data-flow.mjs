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

async function signIn(client, email, password) {
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

const probeId = `job_live_flow_${Date.now()}`;
const john = browserClient();

try {
  await signIn(john, env.JOHN_TEST_EMAIL, env.JOHN_TEST_PASSWORD);

  const { data: northstarClients, error: clientsError } = await john
    .from('clients')
    .select('id, account_id')
    .order('id')
    .limit(1);
  if (clientsError) throw clientsError;
  if (!northstarClients.length || northstarClients.some((client) => client.account_id !== 'acct_northstar')) {
    throw new Error('John received clients outside Northstar.');
  }

  const probeJob = {
    id: probeId,
    account_id: 'acct_northstar',
    client_id: northstarClients[0].id,
    title: 'Live integration verification',
    scheduled_for: new Date().toISOString().slice(0, 10),
    status: 'scheduled',
    assignee: 'Verification',
  };
  const { error: createError } = await john.from('jobs').insert(probeJob);
  if (createError) throw createError;

  const { error: updateError } = await john.from('jobs').update({ status: 'in_progress' }).eq('id', probeId);
  if (updateError) throw updateError;
  await john.auth.signOut();

  await signIn(john, env.JOHN_TEST_EMAIL, env.JOHN_TEST_PASSWORD);
  const { data: persisted, error: persistedError } = await john.from('jobs').select('*').eq('id', probeId).single();
  if (persistedError) throw persistedError;
  if (persisted.status !== 'in_progress') throw new Error('The Scheduling-style update did not persist.');

  const sarah = browserClient();
  await signIn(sarah, env.SARAH_TEST_EMAIL, env.SARAH_TEST_PASSWORD);
  const { data: leakedToSarah, error: sarahReadError } = await sarah.from('jobs').select('id').eq('id', probeId);
  if (sarahReadError) throw sarahReadError;
  if (leakedToSarah.length) throw new Error('RLS failure: Sarah could read John’s verification job.');
  await sarah.auth.signOut();

  const operations = browserClient();
  await signIn(operations, env.OPERATIONS_TEST_EMAIL, env.OPERATIONS_TEST_PASSWORD);
  const { data: visibleToOps, error: opsReadError } = await operations.from('jobs').select('id').eq('id', probeId).single();
  if (opsReadError || !visibleToOps) throw opsReadError || new Error('Operations could not read the verification job.');
  const { data: opsUpdatedRows, error: opsUpdateError } = await operations
    .from('jobs')
    .update({ title: 'Forbidden Operations edit' })
    .eq('id', probeId)
    .select('id');
  if (opsUpdateError) throw opsUpdateError;
  if (opsUpdatedRows.length) throw new Error('RLS failure: Operations was allowed to edit a customer job.');
  await operations.auth.signOut();

  console.log('Live flow verified: John-only data, persistent job edits, Sarah isolation, and read-only Operations access.');
} finally {
  const { data: sessionData } = await john.auth.getSession();
  if (!sessionData.session) await signIn(john, env.JOHN_TEST_EMAIL, env.JOHN_TEST_PASSWORD);
  const { error: cleanupError } = await john.from('jobs').delete().eq('id', probeId);
  if (cleanupError) console.error(`Warning: could not remove verification job ${probeId}: ${cleanupError.message}`);
  await john.auth.signOut();
}
