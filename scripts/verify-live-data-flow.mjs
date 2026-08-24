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
const probeClientId = `client_live_flow_${Date.now()}`;
const john = browserClient();

try {
  const invalidAuth = browserClient();
  const { error: wrongPasswordError } = await invalidAuth.auth.signInWithPassword({
    email: env.JOHN_TEST_EMAIL,
    password: `wrong-${Date.now()}`,
  });
  if (!wrongPasswordError) throw new Error('Authentication accepted an incorrect password.');

  await signIn(john, env.JOHN_TEST_EMAIL, env.JOHN_TEST_PASSWORD);

  const { data: createdClient, error: createClientError } = await john.from('clients').insert({
    id: probeClientId,
    account_id: 'acct_northstar',
    name: 'Live Verification Client',
    city: 'Raleigh',
  }).select().single();
  if (createClientError) throw createClientError;
  if (createdClient.account_id !== 'acct_northstar') throw new Error('Client was created under the wrong account.');

  const { data: updatedClient, error: updateClientError } = await john.from('clients')
    .update({ city: 'Durham' })
    .eq('id', probeClientId)
    .select()
    .single();
  if (updateClientError) throw updateClientError;
  if (updatedClient.city !== 'Durham') throw new Error('Client edit did not persist.');

  const probeJob = {
    id: probeId,
    account_id: 'acct_northstar',
    client_id: probeClientId,
    title: 'Live integration verification',
    scheduled_for: new Date().toISOString().slice(0, 10),
    status: 'scheduled',
    assignee: 'Verification',
  };
  const { error: createError } = await john.from('jobs').insert(probeJob);
  if (createError) throw createError;

  const { error: protectedClientDeleteError } = await john.from('clients').delete().eq('id', probeClientId);
  if (!protectedClientDeleteError) throw new Error('A client with an existing job was deleted.');

  const { error: updateError } = await john.from('jobs').update({ status: 'in_progress' }).eq('id', probeId);
  if (updateError) throw updateError;
  const { error: cancelError } = await john.from('jobs').update({ status: 'cancelled' }).eq('id', probeId);
  if (cancelError) throw cancelError;
  await john.auth.signOut();

  await signIn(john, env.JOHN_TEST_EMAIL, env.JOHN_TEST_PASSWORD);
  const { data: persisted, error: persistedError } = await john.from('jobs').select('*').eq('id', probeId).single();
  if (persistedError) throw persistedError;
  if (persisted.status !== 'cancelled') throw new Error('The Scheduling-style cancel action did not persist.');

  const sarah = browserClient();
  await signIn(sarah, env.SARAH_TEST_EMAIL, env.SARAH_TEST_PASSWORD);
  const { data: leakedToSarah, error: sarahReadError } = await sarah.from('jobs').select('id').eq('id', probeId);
  if (sarahReadError) throw sarahReadError;
  if (leakedToSarah.length) throw new Error('RLS failure: Sarah could read John’s verification job.');
  const { data: crossAccountInsert, error: crossAccountInsertError } = await sarah.from('jobs').insert({
    ...probeJob,
    id: `${probeId}_cross_account`,
  }).select('id');
  if (!crossAccountInsertError && crossAccountInsert.length) throw new Error('RLS failure: Sarah inserted a Northstar job.');
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
  const { data: opsDeletedRows, error: opsDeleteError } = await operations.from('jobs').delete().eq('id', probeId).select('id');
  if (opsDeleteError) throw opsDeleteError;
  if (opsDeletedRows.length) throw new Error('RLS failure: Operations was allowed to delete a customer job.');
  await operations.auth.signOut();

  const { error: deleteJobError } = await john.from('jobs').delete().eq('id', probeId);
  if (deleteJobError) throw deleteJobError;
  const { error: deleteClientError } = await john.from('clients').delete().eq('id', probeClientId);
  if (deleteClientError) throw deleteClientError;

  console.log('Live flow verified: authentication, client/job CRUD, persistence, account isolation, and read-only Operations access.');
} finally {
  const { data: sessionData } = await john.auth.getSession();
  if (!sessionData.session) await signIn(john, env.JOHN_TEST_EMAIL, env.JOHN_TEST_PASSWORD);
  const { error: cleanupError } = await john.from('jobs').delete().eq('id', probeId);
  if (cleanupError) console.error(`Warning: could not remove verification job ${probeId}: ${cleanupError.message}`);
  const { error: clientCleanupError } = await john.from('clients').delete().eq('id', probeClientId);
  if (clientCleanupError) console.error(`Warning: could not remove verification client ${probeClientId}: ${clientCleanupError.message}`);
  await john.auth.signOut();
}
