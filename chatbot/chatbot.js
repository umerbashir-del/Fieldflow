import { accounts, clients, jobs } from './data.js';
import { getAnswer } from './model.js';
import { buildMockAppLink, isMockContractor, mockUserFromSearch } from '../shared-data/mockSession.js';
import { clearMockDataSession, loadMockAccountData } from '../shared-data/mockDataSession.js';

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
const mockAccount = mockUser && (accounts.find((account) => account.id === mockUser.account_id) ?? { id: mockUser.account_id, name: mockUser.company_name ?? 'Your new business', plan: 'Starter' });
const chatGate = document.getElementById('chatLoginGate');
const chatApp = document.getElementById('chatApp');

if (!isMockContractor(mockUser)) {
  chatGate.hidden = false;
} else {
  chatApp.hidden = false;
  startChat();
}

function startChat() {
let accountId = mockUser.account_id;
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
  const visibleAccounts = mockUser ? [mockAccount] : accounts;
  accountSelect.replaceChildren(...visibleAccounts.map((account) => {
    const option = document.createElement('option');
    option.value = account.id;
    option.selected = account.id === accountId;
    option.textContent = account.name;
    return option;
  }));
  accountSelect.disabled = Boolean(mockUser);
  if (mockUser) accountSelect.title = `Demo mode: signed in as ${mockUser.name}.`;
}

function renderAppLinks() {
  schedulingLink.href = buildMockAppLink('http://127.0.0.1:5174/', mockUser);
  analyticsLink.href = buildMockAppLink('http://127.0.0.1:5173/', mockUser);
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
        <div class="ff-job-meta">${escapeHtml(job.client)} · ${escapeHtml(job.assignee)}</div>
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
    const data = loadMockAccountData(mockAccount.id, { clients, jobs });
    const result = getAnswer(trimmed, { account: mockAccount, ...data });
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

signOutButton.addEventListener('click', () => {
  clearMockDataSession();
  window.location.assign('http://127.0.0.1:5174/');
});

renderAccountOptions();
renderAppLinks();
renderChips();
renderMessages();
}
