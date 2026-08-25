// A tab-scoped bridge for the local demo. Scheduling, Analytics, and Chatbot
// run on different Vite ports, so browser localStorage cannot be shared between
// them. window.name survives same-tab navigation and lets the demo carry only
// the current account's edited records between those screens.
//
// This is not production storage and must never hold real customer data.
const SESSION_KEY = 'fieldflowMockData';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function readSession() {
  if (typeof window === 'undefined') return {};
  try {
    const parsed = JSON.parse(window.name || '{}');
    return parsed?.[SESSION_KEY]?.accounts ?? {};
  } catch {
    return {};
  }
}

export function loadMockAccountData(accountId, fallback) {
  const saved = readSession()[accountId];
  if (saved && Array.isArray(saved.clients) && Array.isArray(saved.jobs)) return clone(saved);
  return {
    clients: clone((fallback.clients ?? []).filter((client) => client.account_id === accountId)),
    jobs: clone((fallback.jobs ?? []).filter((job) => job.account_id === accountId)),
  };
}

export function saveMockAccountData(accountId, data) {
  if (typeof window === 'undefined' || !accountId) return;
  const accounts = readSession();
  accounts[accountId] = {
    clients: clone((data.clients ?? []).filter((client) => client.account_id === accountId)),
    jobs: clone((data.jobs ?? []).filter((job) => job.account_id === accountId)),
  };
  window.name = JSON.stringify({ [SESSION_KEY]: { accounts } });
}

export function clearMockDataSession() {
  if (typeof window !== 'undefined') window.name = '';
}

// window.name already carries this tab's demo data across same-tab
// navigation, even cross-origin (Scheduling/Analytics/Chatbot each run on
// their own port). This attaches the same payload as a URL param too, as a
// fallback for browsers/contexts where window.name isn't preserved (e.g. a
// link opened in a new tab), so the destination product can still recover
// the current demo data if it chooses to read the `mock_data` param.
export function buildMockDataLink(href) {
  if (typeof window === 'undefined' || !window.name) return href;
  try {
    const url = new URL(href, window.location.href);
    url.searchParams.set('mock_data', window.name);
    return url.toString();
  } catch {
    return href;
  }
}
