import { createClient } from '@supabase/supabase-js';
import { runAbortableRequest } from './requestSafety.js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

const REQUEST_TIMEOUT_MS = 10000;
const COMPANY_DATA_CACHE_MS = 15_000;
const companyDataCache = new Map();
const JOB_FIELDS = 'id, account_id, client_id, title, scheduled_for, status, assignee, scheduled_start_time, appointment_confirmation_status, contact_method, confirmed_by, confirmation_note, last_contacted_at, confirmed_at, job_category, estimated_duration_minutes, actual_duration_minutes, invoice_total, completed_at, lead_source, technician_id, customer_satisfaction_rating';
const CLIENT_FIELDS = 'id, account_id, name, building_number, street_name, city, state, zip_code, client_phone';

function copyCompanyData(data) {
  return { jobs: data.jobs.map((job) => ({ ...job })), clients: data.clients.map((client) => ({ ...client })) };
}

function clearCompanyDataCache() {
  companyDataCache.clear();
}

function withRequestTimeout(promise, label = 'Supabase request') {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out.`)), REQUEST_TIMEOUT_MS);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function withAbortableRequest(request, label = 'Supabase request') {
  return runAbortableRequest((signal) => request.abortSignal(signal), { label, timeoutMs: REQUEST_TIMEOUT_MS });
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

export async function getOperationsSummaries() {
  const client = requireSupabase();
  const request = client.rpc('get_operations_account_summaries');
  const { data, error } = await withAbortableRequest(request, 'Operations summary request');
  if (error) throw error;
  return data;
}

// Operations Support can answer cross-company questions. It is opened only by
// authorized staff, unlike the Operations dashboard home screen, which uses
// the compact summary request above.
export async function getOperationsData() {
  const client = requireSupabase();
  const request = Promise.all([
    client.from('accounts').select('id, name, plan, demo_reporting_date').order('name'),
    client.from('clients').select(CLIENT_FIELDS).order('name'),
    client.from('jobs').select(JOB_FIELDS).order('scheduled_for', { ascending: false }),
  ]);
  const [accountResult, clientResult, jobResult] = await withRequestTimeout(request, 'Operations Support data request');
  const error = accountResult.error || clientResult.error || jobResult.error;
  if (error) throw error;
  return { accounts: accountResult.data, clients: clientResult.data, jobs: jobResult.data };
}

export async function getOperationsAccountDetail(accountId) {
  const [account, data] = await Promise.all([getAccountById(accountId), getAccountData(accountId)]);
  return { account, ...data };
}

export async function getAnalyticsSummary(accountId, periodStart, periodEnd) {
  const request = requireSupabase().rpc('get_analytics_summary', {
    requested_account_id: accountId,
    period_start: periodStart,
    period_end: periodEnd,
  });
  const { data, error } = await withAbortableRequest(request, 'Analytics summary request');
  if (error) throw error;
  return data?.[0] ?? null;
}

export async function getJobsForAccount(accountId) {
  const request = requireSupabase()
    .from('jobs')
    .select(JOB_FIELDS)
    .eq('account_id', accountId)
    .order('scheduled_for', { ascending: true });
  const { data, error } = await withAbortableRequest(request, 'Jobs request');
  if (error) throw error;
  return data;
}

export async function getAccountById(accountId) {
  const request = requireSupabase()
    .from('accounts')
    .select('id, name, plan, demo_reporting_date')
    .eq('id', accountId)
    .maybeSingle();
  const { data, error } = await withAbortableRequest(request, 'Account request');
  if (error) throw error;
  return data;
}

export async function getClientsForAccount(accountId) {
  const request = requireSupabase()
    .from('clients')
    .select(CLIENT_FIELDS)
    .eq('account_id', accountId)
    .order('name', { ascending: true });
  const { data, error } = await withAbortableRequest(request, 'Clients request');
  if (error) throw error;
  return data;
}

export async function getJobActivityForAccount(accountId) {
  const request = requireSupabase().from('job_activity').select('*').eq('account_id', accountId).order('occurred_at', { ascending: false }).limit(20);
  const { data, error } = await withAbortableRequest(request, 'Job activity request');
  if (error && isMissingJobActivityTable(error)) return [];
  if (error) throw error;
  return data;
}

export function isMissingJobActivityTable(error) {
  const text = `${error?.code ?? ''} ${error?.message ?? ''}`.toLowerCase();
  return text.includes('42p01') || text.includes('pgrst205') || text.includes('job_activity');
}

export function subscribeToAccountChanges(accountId, callback) {
  const client = requireSupabase();
  const channel = client.channel(`fieldflow-account-${accountId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs', filter: `account_id=eq.${accountId}` }, callback)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'clients', filter: `account_id=eq.${accountId}` }, callback)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'job_activity', filter: `account_id=eq.${accountId}` }, callback)
    .subscribe();
  return () => client.removeChannel(channel);
}

// Shared repository functions for Scheduling and Chatbot. They always use the
// signed-in user's RLS-scoped Supabase client; the browser never chooses a
// privileged account or secret key.
export async function getAccountData(accountId) {
  const cached = companyDataCache.get(accountId);
  if (cached && Date.now() - cached.savedAt < COMPANY_DATA_CACHE_MS) return copyCompanyData(cached.data);
  const [jobs, clients] = await Promise.all([
    getJobsForAccount(accountId),
    getClientsForAccount(accountId),
  ]);
  const data = { jobs, clients };
  companyDataCache.set(accountId, { savedAt: Date.now(), data });
  return copyCompanyData(data);
}

export async function createJob(job) {
  const request = requireSupabase()
    .from('jobs')
    .insert(job)
    .select()
    .single();
  const { data, error } = await withAbortableRequest(request, 'Create job request');
  if (error) throw error;
  clearCompanyDataCache();
  return data;
}

export async function updateJob(jobId, changes) {
  const request = requireSupabase()
    .from('jobs')
    .update(changes)
    .eq('id', jobId)
    .select()
    .single();
  const { data, error } = await withAbortableRequest(request, 'Update job request');
  if (error) throw error;
  clearCompanyDataCache();
  return data;
}

export async function deleteJob(jobId) {
  const request = requireSupabase().from('jobs').delete().eq('id', jobId);
  const { error } = await withAbortableRequest(request, 'Delete job request');
  if (error) throw error;
  clearCompanyDataCache();
}

export async function createFieldflowClient(client) {
  const request = requireSupabase()
    .from('clients')
    .insert(client)
    .select()
    .single();
  const { data, error } = await withAbortableRequest(request, 'Create client request');
  if (error) throw error;
  clearCompanyDataCache();
  return data;
}

export async function updateClient(clientId, changes) {
  const request = requireSupabase()
    .from('clients')
    .update(changes)
    .eq('id', clientId)
    .select()
    .single();
  const { data, error } = await withAbortableRequest(request, 'Update client request');
  if (error) throw error;
  clearCompanyDataCache();
  return data;
}

export async function deleteClient(clientId) {
  const request = requireSupabase().from('clients').delete().eq('id', clientId);
  const { error } = await withAbortableRequest(request, 'Delete client request');
  if (error) throw error;
  clearCompanyDataCache();
}
