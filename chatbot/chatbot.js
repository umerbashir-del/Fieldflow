import { accounts } from './data.js';
import { getAnswer } from './model.js';

const STORAGE_KEY = 'fieldflow_chatbot_account_v1';

const SUGGESTIONS = [
  'How do I create a new job?',
  'What do job statuses mean?',
  "What's my plan?",
  "Why can't I see another company's jobs?",
  "What's on my schedule today?",
];

let accountId = loadAccount();
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

function renderAccountOptions() {
  accountSelect.innerHTML = accounts
    .map((a) => `<option value="${a.id}" ${a.id === accountId ? 'selected' : ''}>${a.name}</option>`)
    .join('');
}

function renderChips() {
  chipsEl.innerHTML = SUGGESTIONS.map((s, i) => `<button type="button" class="chip" data-index="${i}">${s}</button>`).join('');
  chipsEl.querySelectorAll('.chip').forEach((btn) => {
    btn.addEventListener('click', () => sendMessage(SUGGESTIONS[Number(btn.dataset.index)]));
  });
}

function renderMessages() {
  messageList.innerHTML = messages
    .map((m) => {
      const cls = m.role === 'user' ? 'message me' : 'message';
      const meta = m.source ? `<span class="meta">Source: ${escapeHtml(m.source)}</span>` : '';
      return `<div class="${cls}">${escapeHtml(m.text)}${meta}</div>`;
    })
    .join('');
  messageList.scrollTop = messageList.scrollHeight;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function sendMessage(text) {
  const trimmed = text.trim();
  if (!trimmed) return;
  messages.push({ role: 'user', text: trimmed });
  chatInput.value = '';
  renderMessages();

  window.setTimeout(() => {
    const result = getAnswer(trimmed, accountId);
    messages.push({ role: 'bot', text: result.text, source: result.source });
    renderMessages();
  }, 350);
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

renderAccountOptions();
renderChips();
renderMessages();
