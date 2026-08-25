import { accounts, clients, jobs } from './data.js';
import { getAnswer, NO_ANSWER_TEXT } from './model.js';
import { askApi } from './apiFallback.js';
import { buildMockAppLink, isMockContractor, mockUserFromSearch } from '../shared-data/mockSession.js';
import { buildMockDataLink, clearMockDataSession, loadMockAccountData } from '../shared-data/mockDataSession.js';
import { APP_URLS } from '../shared-data/appConfig.js';
import { getAccountData, getOperationsData, getOperationsSession, getSignedInAccount, isSupabaseConfigured, signOut, supabase } from '../shared-data/supabase.js';
import { formatReportingDate, reportingDateFromAccount, toggleReportingDateInCurrentUrl, withReportingDate } from '../shared-data/reportingDate.js';
import { assigneeLabel } from '../shared-data/jobPresentation.js';

// When embedded via embed.js on another app's page (Scheduling, Operations),
// the host page bridges its already-signed-in Supabase session into this
// iframe via postMessage: each origin/port has its own separate browser
// storage in local dev, so without this the widget can't see a session the
// host page already has, and asks the visitor to sign in a second time.
// Registered first, before anything below reads the current session.
if (isSupabaseConfigured) {
  window.addEventListener('message', async (event) => {
    if (event.data?.type === 'fieldflow-session-clear') {
      const { data: { session: existing } } = await supabase.auth.getSession();
      if (existing) {
        await supabase.auth.signOut();
        window.location.reload();
      }
      return;
    }
    if (event.data?.type !== 'fieldflow-session' || !event.data.accessToken || !event.data.refreshToken) return;
    // Compare tokens, not just "is anyone signed in": this iframe's own
    // origin may still hold an unrelated session from a previous visit, and
    // the host page's currently-active account must always win over that.
    const { data: { session: existing } } = await supabase.auth.getSession();
    if (existing?.access_token === event.data.accessToken) return;
    const { error: setSessionError } = await supabase.auth.setSession({
      access_token: event.data.accessToken,
      refresh_token: event.data.refreshToken,
    });
    if (!setSessionError) window.location.reload();
  });
}

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

const OPS_ACCOUNT = { id: 'ops', name: 'FieldFlow Operations', plan: null };
const loadingState = document.getElementById('chatLoading');
const chatGate = document.getElementById('chatLoginGate');
const chatApp = document.getElementById('chatApp');
const chatRetryButton = document.getElementById('chatRetryButton');
const mockUser = mockUserFromSearch(window.location.search);
let liveContext = null;
let liveOpsContext = null;
let isOpsUser = mockUser?.role === 'ops';
let activeAccount = null;
let liveData = null;
let liveOpsData = null;
let loadError = '';
try {
  liveContext = isSupabaseConfigured ? await getSignedInAccount() : null;
  // A staff membership takes priority when one login has both roles.
  liveOpsContext = isSupabaseConfigured ? await getOperationsSession().catch(() => null) : null;
  isOpsUser = isSupabaseConfigured ? Boolean(liveOpsContext?.staff) : mockUser?.role === 'ops';
  activeAccount = isSupabaseConfigured
    ? (isOpsUser ? OPS_ACCOUNT : liveContext?.account)
    : (isOpsUser ? OPS_ACCOUNT : mockUser && (accounts.find((account) => account.id === mockUser.account_id) ?? { id: mockUser.account_id, name: mockUser.company_name ?? 'Your new business', plan: 'Starter' }));
  liveData = isSupabaseConfigured && activeAccount && !isOpsUser ? await getAccountData(activeAccount.id) : null;
  liveOpsData = isSupabaseConfigured && isOpsUser ? await getOperationsData().catch(() => null) : null;
} catch (error) {
  const message = String(error?.message ?? '').toLowerCase();
  loadError = message.includes('jwt') || message.includes('session') || message.includes('401')
    ? 'Your session expired. Please sign in again.'
    : message.includes('permission') || message.includes('row-level')
    ? 'You don’t have access to this company’s data.'
    : typeof navigator !== 'undefined' && !navigator.onLine
    ? 'You appear to be offline. Check your connection and try again.'
    : 'We couldn’t load your company data. Check your connection and try again.';
}
const reporting = isSupabaseConfigured
  ? reportingDateFromAccount(activeAccount, window.location.search)
  : reportingDateFromAccount({ demo_reporting_date: '2026-08-19' }, window.location.search);
loadingState.hidden = true;
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

// The floating launcher/widget shell wraps both the sign-in gate and the
// chat app, so it behaves the same whether the visitor is signed in or
// not — the launcher always opens the panel, which shows whichever of the
// two sections below is currently unhidden. This has to live outside
// startChat() (which only runs once signed in) so the launcher still works
// for a signed-out visitor.
const launcher = document.getElementById('ffLauncher');
const widget = document.getElementById('ffWidget');
const closeBtn = document.getElementById('ffClose');

// When loaded inside another app's page via embed.js, this page runs
// inside an iframe with ?embed=1: the host page supplies its own launcher
// button, so this page skips its own and stays permanently "open," and its
// close button asks the host to hide the iframe instead of toggling itself.
const isEmbedded = new URLSearchParams(window.location.search).get('embed') === '1';
if (isEmbedded) document.body.classList.add('ff-embed');

function openWidget() {
  widget.classList.add('is-open');
  launcher.classList.add('is-hidden');
  document.getElementById('chatInput')?.focus();
}

function closeWidget() {
  if (isEmbedded) {
    window.parent.postMessage({ type: 'fieldflow-chat-close' }, '*');
    return;
  }
  widget.classList.remove('is-open');
  launcher.classList.remove('is-hidden');
}

launcher.addEventListener('click', openWidget);
closeBtn.addEventListener('click', closeWidget);
// Open by default even outside an iframe: visiting this page's own URL
// directly (e.g. the "Support Chat" link from Scheduling) is itself the
// equivalent of clicking a launcher elsewhere, so there's no reason to
// make a visitor click twice. The close button still collapses it back
// to just the launcher, which reopens it the same way.
openWidget();

if (loadError) {
  chatGate.querySelector('h1').textContent = 'Support is temporarily unavailable';
  chatGate.querySelector('p:not(.ff-eyebrow)').textContent = loadError;
  chatGate.hidden = false;
  chatRetryButton.hidden = loadError.includes('session');
  chatRetryButton.addEventListener('click', () => window.location.reload());
} else if (isSupabaseConfigured ? !activeAccount : !isMockContractor(mockUser) && !isOpsUser) {
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

// A new company starts with no activity. Say so up front instead of making
// the owner guess whether Support loaded the correct account.
const initialData = isSupabaseConfigured
  ? (isOpsUser ? liveOpsData : liveData)
  : (isOpsUser ? { clients, jobs } : loadMockAccountData(activeAccount.id, { clients, jobs }));
if (!isOpsUser && !(initialData?.jobs ?? []).length) {
  messages.push({
    role: 'bot',
    text: 'Your account has no jobs yet. Create your first job in Scheduling when you are ready.',
  });
}

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

async function sendMessage(text) {
  const trimmed = text.trim();
  if (!trimmed || typing) return;
  messages.push({ role: 'user', text: trimmed });
  chatInput.value = '';
  typing = true;
  renderMessages();

  await new Promise((resolve) => window.setTimeout(resolve, 650));

  const data = isSupabaseConfigured
    ? (isOpsUser ? liveOpsData : liveData)
    : (isOpsUser ? { clients, jobs } : loadMockAccountData(activeAccount.id, { clients, jobs }));
  let result = getAnswer(trimmed, {
    account: activeAccount,
    ...data,
    referenceDate: reporting.date,
    isOps: isOpsUser,
  });
  if (result.text === NO_ANSWER_TEXT) {
    const apiResult = await askApi(trimmed, activeAccount.id);
    if (apiResult) result = apiResult;
  }

  typing = false;
  messages.push({ role: 'bot', text: result.text, source: result.source, jobs: result.jobs });
  renderMessages();
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
