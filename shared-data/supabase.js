import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

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

export async function signOut() {
  const { error } = await requireSupabase().auth.signOut();
  if (error) throw error;
}

export async function getSignedInAccount() {
  const client = requireSupabase();
  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError) throw userError;
  if (!user) return null;

  const { data, error } = await client
    .from('account_memberships')
    .select('account_id, role, accounts(id, name, plan)')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { user, membership: null, account: null };

  return { user, membership: data, account: data.accounts };
}

export async function getJobsForAccount(accountId) {
  const { data, error } = await requireSupabase()
    .from('jobs')
    .select('*')
    .eq('account_id', accountId)
    .order('scheduled_for', { ascending: true });
  if (error) throw error;
  return data;
}

export async function getClientsForAccount(accountId) {
  const { data, error } = await requireSupabase()
    .from('clients')
    .select('*')
    .eq('account_id', accountId)
    .order('name', { ascending: true });
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
