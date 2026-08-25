import { accounts } from './data.js';
import { getAnswer, NO_ANSWER_TEXT } from './model.js';
import { askApi } from './apiFallback.js';

const STORAGE_KEY = 'fieldflow_chatbot_account_v1';

const SUGGESTIONS = [
  'How do I create a new job?',
  'What do job statuses mean?',
  "What's my plan?",
  "Why can't I see another company's jobs?",
  "What's on my schedule today?",
];

const STATUS_LABEL = {
  scheduled: 'Scheduled',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

let accountId = loadAccount();
let typing = false;
const messages = [
  { role: 'bot', text: "Hi, I'm the FieldFlow assistant. Ask me setup or how-to questions, or ask about your account." },
];

function loadAccount() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && accounts.some((a) => a.id === saved)) return saved;
  } catch (e) { /* ignore blocked storage */ }
  return accounts.find((a) => a.id === 'acct_northstar')?.id ?? accounts[0].id;
}

function saveAccount() {
  try { localStorage.setItem(STORAGE_KEY, accountId); } catch (e) { /* ignore blocked storage */ }
}

const accountSelect = document.getElementById('accountSelect');
const messageList = document.getElementById('messageList');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const chipsEl = document.getElementById('suggestionChips');
const launcher = document.getElementById('ffLauncher');
const widget = document.getElementById('ffWidget');
const closeBtn = document.getElementById('ffClose');

function renderAccountOptions() {
  accountSelect.innerHTML = accounts
    .map((a) => `<option value="${a.id}" ${a.id === accountId ? 'selected' : ''}>${a.name}</option>`)
    .join('');
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

async function sendMessage(text) {
  const trimmed = text.trim();
  if (!trimmed || typing) return;
  messages.push({ role: 'user', text: trimmed });
  chatInput.value = '';
  typing = true;
  renderMessages();

  await new Promise((resolve) => window.setTimeout(resolve, 650));

  let result = getAnswer(trimmed, accountId);
  if (result.text === NO_ANSWER_TEXT) {
    const apiResult = await askApi(trimmed, accountId);
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

// When loaded inside another app's page via embed.js, this page runs
// inside an iframe with ?embed=1: the host page supplies its own launcher
// button, so this page skips its own and stays permanently "open," and its
// close button asks the host to hide the iframe instead of toggling itself.
const isEmbedded = new URLSearchParams(window.location.search).get('embed') === '1';
if (isEmbedded) document.body.classList.add('ff-embed');

function openWidget() {
  widget.classList.add('is-open');
  launcher.classList.add('is-hidden');
  chatInput.focus();
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

if (isEmbedded) openWidget();

renderAccountOptions();
renderChips();
renderMessages();
