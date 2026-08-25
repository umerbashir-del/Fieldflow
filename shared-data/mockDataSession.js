// A tab-scoped bridge for the local demo. Scheduling, Analytics, and Chatbot
// run on different Vite ports, so browser localStorage cannot be shared between
// them. window.name survives same-tab navigation and lets the demo carry only
// the current account's edited records between those screens.
//
// This is not production storage and must never hold real customer data.
const SESSION_KEY = 'fieldflowMockData';
const TRANSFER_PARAM = 'demo_state';
let transferConsumed = false;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function validObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function readTransferredSession() {
  if (typeof window === 'undefined' || transferConsumed) return null;
  try {
    const encoded = new URLSearchParams(window.location?.search ?? '').get(TRANSFER_PARAM);
    if (!encoded) return null;
    const changes = validObject(JSON.parse(encoded)?.changes);
    if (!changes) return null;
    transferConsumed = true;
    const envelope = { accounts: {}, changes };
    window.name = JSON.stringify({ [SESSION_KEY]: envelope });
    return envelope;
  } catch {
    return null;
  }
}

function readSession() {
  if (typeof window === 'undefined') return { accounts: {}, changes: {} };
  const transferred = readTransferredSession();
  if (transferred) return transferred;
  try {
    const parsed = JSON.parse(window.name || '{}');
    const saved = parsed?.[SESSION_KEY] ?? {};
    return {
      accounts: validObject(saved.accounts) ?? {},
      changes: validObject(saved.changes) ?? {},
    };
  } catch {
    return { accounts: {}, changes: {} };
  }
}

function recordChanges(records, baseline) {
  const baselineById = new Map((baseline ?? []).map((record) => [record.id, record]));
  const currentIds = new Set(records.map((record) => record.id));
  return {
    upserts: records.filter((record) => JSON.stringify(record) !== JSON.stringify(baselineById.get(record.id))),
    deleted: [...baselineById.keys()].filter((id) => !currentIds.has(id)),
  };
}

function applyRecordChanges(baseline, changes) {
  const records = new Map((baseline ?? []).map((record) => [record.id, clone(record)]));
  (changes?.deleted ?? []).forEach((id) => records.delete(id));
  (changes?.upserts ?? []).forEach((record) => records.set(record.id, clone(record)));
  return [...records.values()];
}

export function loadMockAccountData(accountId, fallback) {
  const session = readSession();
  const saved = session.accounts[accountId];
  if (saved && Array.isArray(saved.clients) && Array.isArray(saved.jobs)) return clone(saved);
  const changes = session.changes[accountId];
  if (changes) {
    return {
      clients: applyRecordChanges((fallback.clients ?? []).filter((client) => client.account_id === accountId), changes.clients),
      jobs: applyRecordChanges((fallback.jobs ?? []).filter((job) => job.account_id === accountId), changes.jobs),
    };
  }
  return {
    clients: clone((fallback.clients ?? []).filter((client) => client.account_id === accountId)),
    jobs: clone((fallback.jobs ?? []).filter((job) => job.account_id === accountId)),
  };
}

export function saveMockAccountData(accountId, data, fallback = { clients: [], jobs: [] }) {
  if (typeof window === 'undefined' || !accountId) return;
  const session = readSession();
  const accounts = session.accounts;
  const changes = session.changes;
  accounts[accountId] = {
    clients: clone((data.clients ?? []).filter((client) => client.account_id === accountId)),
    jobs: clone((data.jobs ?? []).filter((job) => job.account_id === accountId)),
  };
  changes[accountId] = {
    clients: recordChanges(accounts[accountId].clients, (fallback.clients ?? []).filter((client) => client.account_id === accountId)),
    jobs: recordChanges(accounts[accountId].jobs, (fallback.jobs ?? []).filter((job) => job.account_id === accountId)),
  };
  window.name = JSON.stringify({ [SESSION_KEY]: { accounts, changes } });
}

// Different local Vite ports are different browser origins. Firefox and
// WebKit clear window.name during that navigation, so local demo links carry
// the already account-scoped synthetic state explicitly. Production uses
// Supabase instead and never calls this helper with real customer data.
export function buildMockDataLink(baseUrl) {
  const url = new URL(baseUrl);
  const { changes } = readSession();
  if (Object.keys(changes).length) {
    url.searchParams.set(TRANSFER_PARAM, JSON.stringify({ changes }));
  }
  return url.toString();
}

export function clearMockDataSession() {
  if (typeof window !== 'undefined') window.name = '';
}
