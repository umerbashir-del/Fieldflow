import { accounts, clients, jobs } from './data.js';
import { getAnswer } from './model.js';
import { buildMockAppLink, isMockContractor, mockUserFromSearch } from '../shared-data/mockSession.js';
import { buildMockDataLink, clearMockDataSession, loadMockAccountData } from '../shared-data/mockDataSession.js';
import { APP_URLS } from '../shared-data/appConfig.js';
import { getAccountData, getSignedInAccount, isSupabaseConfigured, signOut } from '../shared-data/supabase.js';
import { formatReportingDate, reportingDateFromAccount, toggleReportingDateInCurrentUrl, withReportingDate } from '../shared-data/reportingDate.js';
import { assigneeLabel } from '../shared-data/jobPresentation.js';

const STORAGE_KEY = 'fieldflow_chatbot_account_v1';

const SUGGESTIONS = [
  'How do I create a new job?',
  'What do job statuses mean?',
  "What's my plan?",
  "Why can't I see another company's jobs?",
  'What jobs do I have this week?',
];

const STATUS_LABEL = {
  scheduled: 'Scheduled',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const mockUser = mockUserFromSearch(window.location.search);
const liveContext = isSupabaseConfigured ? await getSignedInAccount() : null;
const activeAccount = isSupabaseConfigured
  ? liveContext?.account
  : mockUser && (accounts.find((account) => account.id === mockUser.account_id) ?? { id: mockUser.account_id, name: mockUser.company_name ?? 'Your new business', plan: 'Starter' });
const liveData = isSupabaseConfigured && activeAccount ? await getAccountData(activeAccount.id) : null;
const reporting = isSupabaseConfigured
  ? reportingDateFromAccount(activeAccount, window.location.search)
  : reportingDateFromAccount({ demo_reporting_date: '2026-08-19' }, window.location.search);
const chatGate = document.getElementById('chatLoginGate');
const chatApp = document.getElementById('chatApp');
document.getElementById('chatGateSchedulingLink').href = APP_URLS.scheduling;
const reportingNotice = document.getElementById('chatDemoNotice');
if (activeAccount && reporting.storedDate) {
  const label = reporting.isDemoDate ? 'Demo data — reporting as of ' : 'Live-date preview — reporting as of ';
  reportingNotice.replaceChildren(document.createTextNode(`${label}${formatReportingDate(reporting.isoDate)}. `));
  const dateModeButton = document.createElement('button');
  dateModeButton.type = 'button';
  dateModeButton.className = 'ff-date-mode';
  dateModeButton.textContent = reporting.isDemoDate ? 'Use today' : 'Return to demo date';
  dateModeButton.addEventListener('click', () => toggleReportingDateInCurrentUrl(reporting));
  reportingNotice.append(dateModeButton);
}

if (isSupabaseConfigured ? !activeAccount : !isMockContractor(mockUser)) {
  chatGate.hidden = false;
} else {
  chatApp.hidden = false;
  startChat();
}

function startChat() {
let accountId = activeAccount.id;
let typing = false;
const messages = [
  { role: 'bot', text: "Hi, I'm the FieldFlow assistant. Ask me setup or how-to questions, or ask about your account." },
];

function saveAccount() {
  try { localStorage.setItem(STORAGE_KEY, accountId); } catch (e) { /* ignore blocked storage */ }
}

const accountSelect = document.getElementById('accountSelect');
const schedulingLink = document.getElementById('chatSchedulingLink');
const analyticsLink = document.getElementById('chatAnalyticsLink');
const signOutButton = document.getElementById('chatSignOutBtn');
const messageList = document.getElementById('messageList');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const chipsEl = document.getElementById('suggestionChips');

function renderAccountOptions() {
  const visibleAccounts = [activeAccount];
  accountSelect.replaceChildren(...visibleAccounts.map((account) => {
    const option = document.createElement('option');
    option.value = account.id;
    option.selected = account.id === accountId;
    option.textContent = account.name;
    return option;
  }));
  accountSelect.disabled = true;
  accountSelect.title = isSupabaseConfigured ? 'Account is determined by your secure sign-in.' : `Demo mode: signed in as ${mockUser.name}.`;
}

function renderAppLinks() {
  schedulingLink.href = withReportingDate(isSupabaseConfigured ? APP_URLS.scheduling : buildMockDataLink(buildMockAppLink(APP_URLS.scheduling, mockUser)), reporting);
  analyticsLink.href = withReportingDate(isSupabaseConfigured ? APP_URLS.analytics : buildMockDataLink(buildMockAppLink(APP_URLS.analytics, mockUser)), reporting);
}

function renderChips() {
  chipsEl.innerHTML = SUGGESTIONS.map((s, i) => `<button type="button" data-index="${i}">${escapeHtml(s)}</button>`).join('');
  chipsEl.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => sendMessage(SUGGESTIONS[Number(btn.dataset.index)]));
  });
}

function jobCardHtml(job) {
  const date = new Date(`${job.iso}T00:00:00Z`);
  const month = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' }).format(date);
  const day = new Intl.DateTimeFormat('en-US', { day: 'numeric', timeZone: 'UTC' }).format(date);
  const statusKey = STATUS_LABEL[job.status] ? job.status : 'scheduled';
  return `
    <div class="ff-job-card">
      <div class="ff-job-date"><span class="month">${escapeHtml(month)}</span><span class="day">${escapeHtml(day)}</span></div>
      <div class="ff-job-info">
        <div class="ff-job-title">${escapeHtml(job.title)}</div>
        <div class="ff-job-meta">${escapeHtml(job.client)} · ${escapeHtml(assigneeLabel(job.assignee))}</div>
      </div>
      <span class="ff-status-badge ff-status--${statusKey}"><span class="dot"></span>${escapeHtml(STATUS_LABEL[statusKey])}</span>
    </div>`;
}

function messageHtml(m) {
  const isUser = m.role === 'user';
  const rowClass = `ff-msg-row${isUser ? ' ff-msg-row--user' : ''}`;
  const avatar = isUser ? '' : `<div class="ff-msg-avatar"><img src="robot.png" alt="bot" /></div>`;
  const bubbleClass = `ff-bubble ${isUser ? 'ff-bubble--user' : 'ff-bubble--bot'}`;
  const jobsHtml = m.jobs && m.jobs.length
    ? `<div class="ff-jobs">${m.jobs.map(jobCardHtml).join('')}</div>`
    : '';
  const sourceHtml = m.source
    ? `<span class="ff-source"><span class="dot"></span>${escapeHtml(m.source)}</span>`
    : '';
  return `
    <div class="${rowClass}">
      ${avatar}
      <div class="ff-msg-col">
        <div class="${bubbleClass}">${escapeHtml(m.text)}</div>
        ${jobsHtml}
        ${sourceHtml}
      </div>
    </div>`;
}

function typingHtml() {
  return `
    <div class="ff-msg-row">
      <div class="ff-msg-avatar"><img src="robot.png" alt="bot" /></div>
      <div class="ff-typing-bubble"><span></span><span></span><span></span></div>
    </div>`;
}

function renderMessages() {
  messageList.innerHTML = messages.map(messageHtml).join('') + (typing ? typingHtml() : '');
  messageList.scrollTop = messageList.scrollHeight;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function sendMessage(text) {
  const trimmed = text.trim();
  if (!trimmed || typing) return;
  messages.push({ role: 'user', text: trimmed });
  chatInput.value = '';
  typing = true;
  renderMessages();

  window.setTimeout(() => {
    const data = isSupabaseConfigured ? liveData : loadMockAccountData(activeAccount.id, { clients, jobs });
    const result = getAnswer(trimmed, {
      account: activeAccount,
      ...data,
      referenceDate: reporting.date,
    });
    typing = false;
    messages.push({ role: 'bot', text: result.text, source: result.source, jobs: result.jobs });
    renderMessages();
  }, 650);
}

chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  sendMessage(chatInput.value);
});

accountSelect.addEventListener('change', () => {
  accountId = accountSelect.value;
  saveAccount();
  const account = accounts.find((a) => a.id === accountId);
  messages.push({ role: 'bot', text: `Switched to ${account.name}. I'll scope account lookups to this account from now on.` });
  renderMessages();
});

signOutButton.addEventListener('click', async () => {
  if (isSupabaseConfigured) await signOut();
  clearMockDataSession();
  window.location.assign(APP_URLS.scheduling);
});

renderAccountOptions();
renderAppLinks();
renderChips();
renderMessages();
}
