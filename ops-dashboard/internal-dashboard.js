import accounts from '../shared-data/accounts.json';
import clients from '../shared-data/clients.json';
import jobs from '../shared-data/jobs.json';
import { APP_URLS } from '../shared-data/appConfig.js';
import { getOperationsData, getOperationsSession, isSupabaseConfigured } from '../shared-data/supabase.js';

let accountData = accounts;
let clientData = clients;
let jobData = jobs;
if (isSupabaseConfigured) {
  const operations = await getOperationsSession();
  if (operations?.staff) {
    const live = await getOperationsData();
    accountData = live.accounts;
    clientData = live.clients;
    jobData = live.jobs;
  } else {
    accountData = [];
    clientData = [];
    jobData = [];
  }
}

const THEME_KEY = 'fieldflow_ops_theme';
const STATUS_LABELS = { scheduled: 'Scheduled', in_progress: 'In progress', completed: 'Completed', cancelled: 'Cancelled' };
const state = { view: 'overview', selectedAccountId: null, accountSearch: '', statusFilter: 'all', theme: localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light' };
const $ = (id) => document.getElementById(id);
const els = {
  accountCount: $('accountCount'), clientCount: $('clientCount'), jobCount: $('jobCount'), progressCount: $('progressCount'),
  accountTable: $('accountTable'), accountCards: $('accountCards'), activityList: $('activityList'), detailContent: $('detailContent'),
  accountSearch: $('accountSearch'), statusFilter: $('statusFilter'), themeBtn: $('themeBtn'), backBtn: $('backBtn'),
  tabs: [...document.querySelectorAll('.tab')], views: { overview: $('overview'), accounts: $('accounts'), activity: $('activity'), detail: $('detail') },
};

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
  const accountClients = clientData.filter((client) => client.account_id === account.id);
  const accountJobs = jobData.filter((job) => job.account_id === account.id);
  const completed = accountJobs.filter((job) => job.status === 'completed').length;
  const open = accountJobs.filter((job) => job.status === 'scheduled' || job.status === 'in_progress').length;
  const status = open > 0 ? 'Active' : accountJobs.length > 0 ? 'No open work' : 'No activity';
  const statusClass = open > 0 ? 'healthy' : accountJobs.length > 0 ? 'warning' : 'cancelled';
  return { account, clients: accountClients, jobs: accountJobs, completed, open, status, statusClass };
}

function jobHtml(job, includeAccount = true) {
  const account = accountData.find((item) => item.id === job.account_id);
  const client = clientData.find((item) => item.id === job.client_id);
  const subtitle = includeAccount ? `${account?.name ?? 'Unknown account'} · ${client?.name ?? 'Unknown client'}` : formatDate(job.scheduled_for);
  return `<article class="job"><div><div class="job-title">${escapeHtml(job.title || 'Scheduled job')}</div><div class="job-meta">${escapeHtml(subtitle)}</div></div><div><span class="badge ${badgeClass(job.status)}">${escapeHtml(STATUS_LABELS[job.status] ?? job.status)}</span><div class="job-meta">${includeAccount ? formatDate(job.scheduled_for) : ''}</div></div></article>`;
}

function renderOverview() {
  els.accountCount.textContent = accountData.length;
  els.clientCount.textContent = clientData.length;
  els.jobCount.textContent = jobData.length;
  els.progressCount.textContent = jobData.filter((job) => job.status === 'in_progress').length;
  els.accountTable.innerHTML = accountData.map((account) => {
    const summary = accountSummary(account);
    return `<tr><td><button class="account-table-link" type="button" data-account-id="${escapeHtml(account.id)}">${escapeHtml(account.name)}</button></td><td>${escapeHtml(account.plan)}</td><td>${summary.clients.length}</td><td>${summary.jobs.length}</td><td>${summary.completed}</td><td>${summary.open}</td><td><span class="badge ${summary.statusClass}">${summary.status}</span></td></tr>`;
  }).join('');
  document.querySelectorAll('.account-table-link').forEach((button) => button.addEventListener('click', () => openAccount(button.dataset.accountId)));
}

function renderAccounts() {
  const query = state.accountSearch.trim().toLowerCase();
  const filtered = accountData.filter((account) => !query || `${account.name} ${account.plan}`.toLowerCase().includes(query));
  els.accountCards.innerHTML = filtered.length ? filtered.map((account) => {
    const summary = accountSummary(account);
    return `<button class="card account-card" type="button" data-account-id="${escapeHtml(account.id)}"><span class="account-name">${escapeHtml(account.name)}</span><span class="plan">${escapeHtml(account.plan)}</span><span class="account-card-metrics">${summary.clients.length} clients · ${summary.jobs.length} jobs</span><span class="badge ${summary.statusClass}">${summary.status}</span></button>`;
  }).join('') : '<p class="empty">No accounts match that search.</p>';
  document.querySelectorAll('.account-card').forEach((button) => button.addEventListener('click', () => openAccount(button.dataset.accountId)));
}

function renderActivity() {
  const filtered = jobData.filter((job) => state.statusFilter === 'all' || job.status === state.statusFilter).sort((first, second) => second.scheduled_for.localeCompare(first.scheduled_for));
  els.activityList.innerHTML = filtered.length ? filtered.map((job) => jobHtml(job)).join('') : '<p class="empty">No jobs match this status.</p>';
}

function renderDetail() {
  const account = accountData.find((item) => item.id === state.selectedAccountId);
  if (!account) return;
  const summary = accountSummary(account);
  const recentJobs = [...summary.jobs].sort((first, second) => second.scheduled_for.localeCompare(first.scheduled_for)).slice(0, 8);
  const analyticsUrl = new URL(APP_URLS.analytics);
  if (!isSupabaseConfigured) analyticsUrl.searchParams.set('demo_user', 'ops');
  analyticsUrl.searchParams.set('account_id', account.id);
  els.detailContent.innerHTML = `<div class="detail-header"><p class="eyebrow">Account detail</p><h2>${escapeHtml(account.name)}</h2><p class="muted">${escapeHtml(account.plan)} plan · ${summary.status}</p><p><a class="account-analytics-link" href="${analyticsUrl.toString()}">View read-only Analytics</a></p></div><div class="grid detail-metrics"><div class="card"><div class="muted">Clients</div><div class="metric">${summary.clients.length}</div></div><div class="card"><div class="muted">Jobs</div><div class="metric">${summary.jobs.length}</div></div><div class="card"><div class="muted">Completed</div><div class="metric">${summary.completed}</div></div><div class="card"><div class="muted">Open work</div><div class="metric">${summary.open}</div></div></div><div class="section"><div class="section-header"><h2>Recent jobs</h2></div><div class="jobs">${recentJobs.length ? recentJobs.map((job) => jobHtml(job, false)).join('') : '<p class="empty">No jobs are available for this account.</p>'}</div></div>`;
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

function openAccount(accountId) { state.selectedAccountId = accountId; showView('detail'); }
function applyTheme() { document.documentElement.dataset.theme = state.theme; els.themeBtn.textContent = state.theme === 'dark' ? 'Light mode' : 'Dark mode'; }

els.tabs.forEach((tab) => tab.addEventListener('click', () => showView(tab.dataset.view)));
els.accountSearch.addEventListener('input', (event) => { state.accountSearch = event.target.value; renderAccounts(); });
els.statusFilter.addEventListener('change', (event) => { state.statusFilter = event.target.value; renderActivity(); });
els.backBtn.addEventListener('click', () => showView('accounts'));
els.themeBtn.addEventListener('click', () => { state.theme = state.theme === 'dark' ? 'light' : 'dark'; localStorage.setItem(THEME_KEY, state.theme); applyTheme(); });
applyTheme();
const requestedAccountId = new URLSearchParams(window.location.search).get('account_id');
if (accountData.some((account) => account.id === requestedAccountId)) openAccount(requestedAccountId);
else showView('overview');
