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

async function withAbortableRequest(request, label = 'Supabase request') {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);
  try {
    const result = await request.abortSignal(controller.signal);
    if (timedOut) throw new Error(`${label} timed out and was cancelled.`);
    return result;
  } catch (error) {
    if (timedOut) throw new Error(`${label} timed out and was cancelled.`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
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
  const [overviewResult, jobResult] = await Promise.all([
    withAbortableRequest(client.rpc('get_operations_overview'), 'Operations overview request'),
    withAbortableRequest(
      client.from('jobs')
        .select('*, account:accounts(name), client:clients(name)')
        .order('scheduled_for', { ascending: false })
        .limit(100),
      'Recent Operations jobs request',
    ),
  ]);
  const error = overviewResult.error || jobResult.error;
  if (error) throw error;
  const accounts = overviewResult.data.map((account) => ({
    id: account.id,
    name: account.name,
    plan: account.plan,
    demo_reporting_date: account.demo_reporting_date,
    metrics: {
      clients: Number(account.client_count),
      jobs: Number(account.job_count),
      completed: Number(account.completed_count),
      open: Number(account.open_count),
      inProgress: Number(account.in_progress_count),
    },
  }));
  const jobs = jobResult.data.map((job) => ({
    ...job,
    account_name: job.account?.name,
    client_name: job.client?.name,
  }));
  return { accounts, clients: [], jobs };
}

export async function getOperationsAccountData(accountId) {
  const client = requireSupabase();
  const [clientResult, jobResult] = await Promise.all([
    withAbortableRequest(client.from('clients').select('*').eq('account_id', accountId).order('name'), 'Operations clients request'),
    withAbortableRequest(client.from('jobs').select('*').eq('account_id', accountId).order('scheduled_for', { ascending: false }).limit(50), 'Operations account jobs request'),
  ]);
  const error = clientResult.error || jobResult.error;
  if (error) throw error;
  return { clients: clientResult.data, jobs: jobResult.data };
}

export async function getAnalyticsDashboardData(accountId, periodStart, periodEnd) {
  const client = requireSupabase();
  const [summaryResult, selectedResult, earliestResult] = await Promise.all([
    withAbortableRequest(client.rpc('get_analytics_summary', {
      requested_account_id: accountId,
      period_start: periodStart,
      period_end: periodEnd,
    }), 'Analytics summary request'),
    withAbortableRequest(
      client.from('jobs').select('*').eq('account_id', accountId).gte('scheduled_for', periodStart).lt('scheduled_for', periodEnd).order('scheduled_for'),
      'Analytics trend request',
    ),
    withAbortableRequest(
      client.from('jobs').select('scheduled_for').eq('account_id', accountId).order('scheduled_for').limit(1).maybeSingle(),
      'Analytics history request',
    ),
  ]);
  const error = summaryResult.error || selectedResult.error || earliestResult.error;
  if (error) throw error;
  const counts = summaryResult.data?.[0];
  if (!counts) throw new Error('Analytics access was not available for this company.');
  return { counts, selectedJobs: selectedResult.data, earliestJobDate: earliestResult.data?.scheduled_for ?? null };
}

export async function getJobsForAccount(accountId) {
  const request = requireSupabase()
    .from('jobs')
    .select('*')
    .eq('account_id', accountId)
    .order('scheduled_for', { ascending: true });
  const { data, error } = await withAbortableRequest(request, 'Jobs request');
  if (error) throw error;
  return data;
}

export async function getAccountById(accountId) {
  const request = requireSupabase()
    .from('accounts')
    .select('*')
    .eq('id', accountId)
    .maybeSingle();
  const { data, error } = await withAbortableRequest(request, 'Account request');
  if (error) throw error;
  return data;
}

export async function getClientsForAccount(accountId) {
  const request = requireSupabase()
    .from('clients')
    .select('*')
    .eq('account_id', accountId)
    .order('name', { ascending: true });
  const { data, error } = await withAbortableRequest(request, 'Clients request');
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
  const request = requireSupabase()
    .from('jobs')
    .upsert(job, { onConflict: 'id', ignoreDuplicates: true })
    .select()
    .maybeSingle();
  const { data, error } = await withAbortableRequest(request, 'Create job request');
  if (error) throw error;
  if (data) return data;
  const { data: existing, error: lookupError } = await withAbortableRequest(
    requireSupabase().from('jobs').select('*').eq('id', job.id).single(),
    'Confirm job request',
  );
  if (lookupError) throw lookupError;
  return existing;
}

export async function updateJob(jobId, changes) {
  const editableChanges = {
    title: changes.title,
    client_id: changes.client_id,
    scheduled_for: changes.scheduled_for,
    status: changes.status,
    assignee: changes.assignee ?? null,
  };
  const request = requireSupabase()
    .from('jobs')
    .update(editableChanges)
    .eq('id', jobId)
    .select()
    .single();
  const { data, error } = await withAbortableRequest(request, 'Update job request');
  if (error) throw error;
  return data;
}

export async function deleteJob(jobId) {
  const request = requireSupabase().from('jobs').delete().eq('id', jobId);
  const { error } = await withAbortableRequest(request, 'Delete job request');
  if (error) throw error;
}

export async function createFieldflowClient(client) {
  const request = requireSupabase()
    .from('clients')
    .upsert(client, { onConflict: 'id', ignoreDuplicates: true })
    .select()
    .maybeSingle();
  const { data, error } = await withAbortableRequest(request, 'Create client request');
  if (error) throw error;
  if (data) return data;
  const { data: existing, error: lookupError } = await withAbortableRequest(
    requireSupabase().from('clients').select('*').eq('id', client.id).single(),
    'Confirm client request',
  );
  if (lookupError) throw lookupError;
  return existing;
}

export async function updateClient(clientId, changes) {
  const editableFields = ['name', 'building_number', 'street_name', 'city', 'state', 'zip_code', 'client_phone'];
  const editableChanges = Object.fromEntries(
    editableFields.filter((field) => Object.hasOwn(changes, field)).map((field) => [field, changes[field]]),
  );
  const request = requireSupabase()
    .from('clients')
    .update(editableChanges)
    .eq('id', clientId)
    .select()
    .single();
  const { data, error } = await withAbortableRequest(request, 'Update client request');
  if (error) throw error;
  return data;
}

export async function deleteClient(clientId) {
  const request = requireSupabase().from('clients').delete().eq('id', clientId);
  const { error } = await withAbortableRequest(request, 'Delete client request');
  if (error) throw error;
}
