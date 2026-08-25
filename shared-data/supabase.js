import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

const REQUEST_TIMEOUT_MS = 10000;

function withRequestTimeout(promise, label = 'Supabase request') {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out.`)), REQUEST_TIMEOUT_MS);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to .env.');
  }
  return supabase;
}

export async function signIn(email, password) {
  const { error } = await requireSupabase().auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signUpBusiness({ email, password, ownerName, companyName }) {
  const { data, error } = await requireSupabase().auth.signUp({
    email,
    password,
    options: {
      data: {
        signup_type: 'fieldflow_business',
        owner_name: ownerName.trim(),
        company_name: companyName.trim(),
      },
    },
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await requireSupabase().auth.signOut();
  if (error) throw error;
}

export async function sendPasswordReset(email, redirectTo) {
  const { error } = await requireSupabase().auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw error;
}

export async function getSession() {
  const { data, error } = await requireSupabase().auth.getSession();
  if (error) throw error;
  return data.session;
}

export function onAuthStateChange(callback) {
  return requireSupabase().auth.onAuthStateChange(callback).data.subscription;
}

async function loadSignedInAccount() {
  const client = requireSupabase();
  const { data: { session }, error: sessionError } = await client.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session) return null;
  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError) throw userError;
  if (!user) return null;

  const { data, error } = await client
    .from('account_memberships')
    .select('account_id, role, accounts(id, name, plan, demo_reporting_date)')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { user, membership: null, account: null };

  return { user, membership: data, account: data.accounts };
}

export function getSignedInAccount() {
  return withRequestTimeout(loadSignedInAccount(), 'Account connection');
}

async function loadOperationsSession() {
  const client = requireSupabase();
  const { data: { session }, error: sessionError } = await client.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session) return null;
  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError) throw userError;
  if (!user) return null;
  const { data, error } = await client
    .from('operations_staff')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) throw error;
  return data ? { user, staff: data } : { user, staff: null };
}

export function getOperationsSession() {
  return withRequestTimeout(loadOperationsSession(), 'Operations connection');
}

export async function getOperationsData() {
  const client = requireSupabase();
  const request = Promise.all([
    client.from('accounts').select('*').order('name'),
    client.from('clients').select('*').order('name'),
    client.from('jobs').select('*').order('scheduled_for', { ascending: false }),
  ]);
  const [accountResult, clientResult, jobResult] = await withRequestTimeout(request, 'Operations data request');
  const error = accountResult.error || clientResult.error || jobResult.error;
  if (error) throw error;
  return { accounts: accountResult.data, clients: clientResult.data, jobs: jobResult.data };
}

export async function getJobsForAccount(accountId) {
  const request = requireSupabase()
    .from('jobs')
    .select('*')
    .eq('account_id', accountId)
    .order('scheduled_for', { ascending: true });
  const { data, error } = await withRequestTimeout(request, 'Jobs request');
  if (error) throw error;
  return data;
}

export async function getAccountById(accountId) {
  const { data, error } = await requireSupabase()
    .from('accounts')
    .select('*')
    .eq('id', accountId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getClientsForAccount(accountId) {
  const request = requireSupabase()
    .from('clients')
    .select('*')
    .eq('account_id', accountId)
    .order('name', { ascending: true });
  const { data, error } = await withRequestTimeout(request, 'Clients request');
  if (error) throw error;
  return data;
}

// Shared repository functions for Scheduling and Chatbot. They always use the
// signed-in user's RLS-scoped Supabase client; the browser never chooses a
// privileged account or secret key.
export async function getAccountData(accountId) {
  const [jobs, clients] = await Promise.all([
    getJobsForAccount(accountId),
    getClientsForAccount(accountId),
  ]);
  return { jobs, clients };
}

export async function createJob(job) {
  const { data, error } = await requireSupabase()
    .from('jobs')
    .insert(job)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateJob(jobId, changes) {
  const { data, error } = await requireSupabase()
    .from('jobs')
    .update(changes)
    .eq('id', jobId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteJob(jobId) {
  const { error } = await requireSupabase().from('jobs').delete().eq('id', jobId);
  if (error) throw error;
}

export async function createFieldflowClient(client) {
  const { data, error } = await requireSupabase()
    .from('clients')
    .insert(client)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateClient(clientId, changes) {
  const { data, error } = await requireSupabase()
    .from('clients')
    .update(changes)
    .eq('id', clientId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteClient(clientId) {
  const { error } = await requireSupabase().from('clients').delete().eq('id', clientId);
  if (error) throw error;
}
