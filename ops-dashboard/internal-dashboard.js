import { APP_URLS } from '../shared-data/appConfig.js';
import { getOperationsAccountDetail, getOperationsSession, getOperationsSummaries, isSupabaseConfigured, signOut } from '../shared-data/supabase.js';
import { formatReportingDate, reportingDateFromAccount, withReportingDate } from '../shared-data/reportingDate.js';

const [accounts, clients, jobs] = __FIELDFLOW_DEMO__
  ? await Promise.all([
      import('../shared-data/accounts.json').then((module) => module.default),
      import('../shared-data/clients.json').then((module) => module.default),
      import('../shared-data/jobs.json').then((module) => module.default),
    ])
  : [[], [], []];

let accountData = accounts;
let clientData = clients;
let jobData = jobs;
let loadError = '';
if (isSupabaseConfigured) {
  try {
    const operations = await getOperationsSession();
    if (operations?.staff) {
      // Operations opens with compact account summaries. Jobs and clients are
      // loaded only after staff choose a company to inspect.
      accountData = await getOperationsSummaries();
      clientData = [];
      jobData = [];
    } else {
      accountData = [];
      clientData = [];
      jobData = [];
    }
  } catch {
    // Do not leave a broken or stale automatic session blocking the login
    // screen. The person can establish a fresh Operations session instead.
    try { await signOut(); } catch { /* Keep the sign-in form usable if offline. */ }
    // The login gate remains visible; do not leave an error from a cleared
    // session on a form that is ready for a fresh sign-in.
    loadError = '';
  }
}

const STATUS_LABELS = { scheduled: 'Scheduled', in_progress: 'In progress', completed: 'Completed', cancelled: 'Cancelled' };
const state = { view: 'overview', selectedAccountId: null, accountSearch: '', statusFilter: 'all', detailLoading: false, detailError: '' };
const $ = (id) => document.getElementById(id);
const els = {
  accountCount: $('accountCount'), clientCount: $('clientCount'), jobCount: $('jobCount'), progressCount: $('progressCount'),
  accountTable: $('accountTable'), accountCards: $('accountCards'), activityList: $('activityList'), detailContent: $('detailContent'),
  accountSearch: $('accountSearch'), statusFilter: $('statusFilter'), backBtn: $('backBtn'),
  tabs: [...document.querySelectorAll('.tab')], views: { overview: $('overview'), accounts: $('accounts'), activity: $('activity'), detail: $('detail') },
};

if (loadError) {
  document.getElementById('opsDashboard').hidden = true;
  document.getElementById('opsLoginGate').hidden = false;
  const errorElement = document.getElementById('opsLoginError');
  const descriptionElement = document.getElementById('operationsLoginDescription');
  const retryElement = document.getElementById('opsRetryButton');
  if (errorElement) errorElement.textContent = loadError;
  if (descriptionElement) descriptionElement.textContent = `${loadError} You can try signing in again.`;
  if (retryElement && !loadError.includes('session')) {
    retryElement.hidden = false;
    retryElement.addEventListener('click', () => window.location.reload());
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

function formatDate(isoDate) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${isoDate}T00:00:00Z`));
}

function badgeClass(status) {
  if (status === 'completed') return 'completed';
  if (status === 'cancelled') return 'cancelled';
  return status === 'in_progress' ? 'warning' : 'healthy';
}

function accountSummary(account) {
  if (account.client_count !== undefined) {
    const clientCount = Number(account.client_count ?? 0);
    const jobCount = Number(account.job_count ?? 0);
    const completed = Number(account.completed_count ?? 0);
    const open = Number(account.open_count ?? 0);
    const status = open > 0 ? 'Active' : jobCount > 0 ? 'No open work' : 'No activity';
    const statusClass = open > 0 ? 'healthy' : jobCount > 0 ? 'warning' : 'cancelled';
    return { account, clientCount, jobCount, completed, open, status, statusClass };
  }
  const accountClients = clientData.filter((client) => client.account_id === account.id);
  const accountJobs = jobData.filter((job) => job.account_id === account.id);
  const completed = accountJobs.filter((job) => job.status === 'completed').length;
  const open = accountJobs.filter((job) => job.status === 'scheduled' || job.status === 'in_progress').length;
  const status = open > 0 ? 'Active' : accountJobs.length > 0 ? 'No open work' : 'No activity';
  const statusClass = open > 0 ? 'healthy' : accountJobs.length > 0 ? 'warning' : 'cancelled';
  return { account, clientCount: accountClients.length, jobCount: accountJobs.length, completed, open, status, statusClass };
}

function jobHtml(job, includeAccount = true) {
  const account = accountData.find((item) => item.id === job.account_id);
  const client = clientData.find((item) => item.id === job.client_id);
  const subtitle = includeAccount ? `${account?.name ?? 'Unknown account'} · ${client?.name ?? 'Unknown client'}` : formatDate(job.scheduled_for);
  return `<article class="job"><div><div class="job-title">${escapeHtml(job.title || 'Scheduled job')}</div><div class="job-meta">${escapeHtml(subtitle)}</div></div><div><span class="badge ${badgeClass(job.status)}">${escapeHtml(STATUS_LABELS[job.status] ?? job.status)}</span><div class="job-meta">${includeAccount ? formatDate(job.scheduled_for) : ''}</div></div></article>`;
}

function renderOverview() {
  els.accountCount.textContent = accountData.length;
  const summaries = accountData.map(accountSummary);
  els.clientCount.textContent = summaries.reduce((total, summary) => total + summary.clientCount, 0);
  els.jobCount.textContent = summaries.reduce((total, summary) => total + summary.jobCount, 0);
  els.progressCount.textContent = summaries.reduce((total, summary) => total + summary.open, 0);
  els.accountTable.innerHTML = accountData.map((account) => {
    const summary = accountSummary(account);
    return `<tr><td><button class="account-table-link" type="button" data-account-id="${escapeHtml(account.id)}">${escapeHtml(account.name)}</button></td><td>${escapeHtml(account.plan)}</td><td>${summary.clientCount}</td><td>${summary.jobCount}</td><td>${summary.completed}</td><td>${summary.open}</td><td><span class="badge ${summary.statusClass}">${summary.status}</span></td></tr>`;
  }).join('');
  document.querySelectorAll('.account-table-link').forEach((button) => button.addEventListener('click', () => openAccount(button.dataset.accountId)));
}

function renderAccounts() {
  const query = state.accountSearch.trim().toLowerCase();
  const filtered = accountData.filter((account) => !query || `${account.name} ${account.plan}`.toLowerCase().includes(query));
  els.accountCards.innerHTML = filtered.length ? filtered.map((account) => {
    const summary = accountSummary(account);
    return `<button class="card account-card" type="button" data-account-id="${escapeHtml(account.id)}"><span class="account-name">${escapeHtml(account.name)}</span><span class="plan">${escapeHtml(account.plan)}</span><span class="account-card-metrics">${summary.clientCount} clients · ${summary.jobCount} jobs</span><span class="badge ${summary.statusClass}">${summary.status}</span></button>`;
  }).join('') : '<p class="empty">No accounts match that search.</p>';
  document.querySelectorAll('.account-card').forEach((button) => button.addEventListener('click', () => openAccount(button.dataset.accountId)));
}

function renderActivity() {
  if (isSupabaseConfigured && !state.selectedAccountId) {
    els.activityList.innerHTML = '<p class="empty">Select a company to load its recent jobs.</p>';
    return;
  }
  const filtered = jobData.filter((job) => state.statusFilter === 'all' || job.status === state.statusFilter).sort((first, second) => second.scheduled_for.localeCompare(first.scheduled_for));
  els.activityList.innerHTML = filtered.length ? filtered.map((job) => jobHtml(job)).join('') : '<p class="empty">No jobs match this status.</p>';
}

function renderDetail() {
  const account = accountData.find((item) => item.id === state.selectedAccountId);
  if (!account) return;
  if (state.detailLoading) {
    els.detailContent.innerHTML = '<p class="empty">Loading this company’s clients and jobs…</p>';
    return;
  }
  if (state.detailError) {
    els.detailContent.innerHTML = `<p class="empty">${escapeHtml(state.detailError)}</p>`;
    return;
  }
  const summary = accountSummary(account);
  const recentJobs = jobData.filter((job) => job.account_id === account.id).sort((first, second) => second.scheduled_for.localeCompare(first.scheduled_for)).slice(0, 8);
  const analyticsUrl = new URL(APP_URLS.analytics);
  if (!isSupabaseConfigured) analyticsUrl.searchParams.set('demo_user', 'ops');
  analyticsUrl.searchParams.set('account_id', account.id);
  const reporting = isSupabaseConfigured
    ? reportingDateFromAccount(account, window.location.search)
    : { isoDate: '2026-08-19', isDemoDate: true, storedDate: '2026-08-19' };
  const reportingNotice = reporting.storedDate
    ? `<p class="muted">${reporting.isDemoDate ? 'Demo data' : 'Live-date preview'} — reporting as of ${escapeHtml(formatReportingDate(reporting.isoDate))}.</p>`
    : '';
  els.detailContent.innerHTML = `<div class="detail-header"><p class="eyebrow">Account detail</p><h2>${escapeHtml(account.name)}</h2><p class="muted">${escapeHtml(account.plan)} plan · ${summary.status}</p>${reportingNotice}<p><a class="account-analytics-link" href="${withReportingDate(analyticsUrl.toString(), reporting)}">View read-only Analytics</a></p></div><div class="grid detail-metrics"><div class="card"><div class="muted">Clients</div><div class="metric">${summary.clientCount}</div></div><div class="card"><div class="muted">Jobs</div><div class="metric">${summary.jobCount}</div></div><div class="card"><div class="muted">Completed</div><div class="metric">${summary.completed}</div></div><div class="card"><div class="muted">Open work</div><div class="metric">${summary.open}</div></div></div><div class="section"><div class="section-header"><h2>Recent jobs</h2></div><div class="jobs">${recentJobs.length ? recentJobs.map((job) => jobHtml(job, false)).join('') : '<p class="empty">No jobs are available for this account.</p>'}</div></div>`;
}

function showView(view) {
  state.view = view;
  Object.entries(els.views).forEach(([name, element]) => element.classList.toggle('hidden', name !== view));
  els.tabs.forEach((tab) => tab.classList.toggle('active', tab.dataset.view === view));
  if (view === 'overview') renderOverview();
  if (view === 'accounts') renderAccounts();
  if (view === 'activity') renderActivity();
  if (view === 'detail') renderDetail();
}

async function openAccount(accountId) {
  state.selectedAccountId = accountId;
  state.detailError = '';
  if (!isSupabaseConfigured) {
    showView('detail');
    return;
  }
  state.detailLoading = true;
  showView('detail');
  try {
    const detail = await getOperationsAccountDetail(accountId);
    clientData = detail.clients;
    jobData = detail.jobs;
    accountData = accountData.map((account) => account.id === accountId ? { ...account, ...detail.account } : account);
  } catch {
    state.detailError = 'We couldn’t load this company’s details. Try again.';
  } finally {
    state.detailLoading = false;
    showView('detail');
  }
}
els.tabs.forEach((tab) => tab.addEventListener('click', () => showView(tab.dataset.view)));
els.accountSearch.addEventListener('input', (event) => { state.accountSearch = event.target.value; renderAccounts(); });
els.statusFilter.addEventListener('change', (event) => { state.statusFilter = event.target.value; renderActivity(); });
els.backBtn.addEventListener('click', () => showView('accounts'));
const requestedAccountId = new URLSearchParams(window.location.search).get('account_id');
if (accountData.some((account) => account.id === requestedAccountId)) openAccount(requestedAccountId);
else showView('overview');
