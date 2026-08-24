import assert from 'node:assert/strict';
import test from 'node:test';
import { authenticateMockUser, buildMockAppLink, createMockAccount, isMockContractor, mockUserFromSearch } from '../../shared-data/mockSession.js';
import { friendlyAuthError, passwordResetConfirmation } from '../../shared-data/authMessages.js';
import { buildMockDataLink, loadMockAccountData, saveMockAccountData } from '../../shared-data/mockDataSession.js';
import { reportingDateFromAccount, withReportingDate } from '../../shared-data/reportingDate.js';
import { assigneeLabel } from '../../shared-data/jobPresentation.js';

test('maps John and Sarah to separate demo accounts', () => {
  assert.equal(authenticateMockUser('john@fieldflow.demo', 'john-demo-password').account_id, 'acct_northstar');
  assert.equal(authenticateMockUser('sarah@fieldflow.demo', 'sarah-demo-password').account_id, 'acct_horizon');
});

test('maps the separate Operations demo account to the ops role', () => {
  const ops = authenticateMockUser('ops@fieldflow.demo', 'ops-demo-password');
  assert.equal(ops.role, 'ops');
  assert.equal(ops.account_id, undefined);
  assert.equal(isMockContractor(ops), false);
  assert.throws(() => buildMockAppLink('http://127.0.0.1:5174/', ops), /Only contractor/);
});

test('does not accept a browser-supplied canonical account for a new demo business', () => {
  const user = mockUserFromSearch('?demo_user=new&demo_name=Avery&demo_email=avery%40example.com&demo_company=Avery+Plumbing&account_id=acct_northstar');
  assert.equal(user, null);
});

test('rejects invalid mock credentials', () => {
  assert.throws(() => authenticateMockUser('john@fieldflow.demo', 'sarah-demo-password'), /demo accounts/);
});

test('passes only the selected demo identity between FieldFlow areas', () => {
  const john = authenticateMockUser('john@fieldflow.demo', 'john-demo-password');
  const link = buildMockAppLink('http://127.0.0.1:5173/', john);
  assert.equal(mockUserFromSearch(new URL(link).search).account_id, 'acct_northstar');
});

test('creates an owner and a new empty demo company context', () => {
  const owner = createMockAccount({ ownerName: 'Avery Smith', companyName: 'Avery Plumbing', email: 'avery@example.com' });
  assert.equal(owner.role, 'owner');
  assert.equal(owner.company_name, 'Avery Plumbing');
  assert.match(owner.account_id, /^acct_demo_/);
  const restored = mockUserFromSearch(new URL(buildMockAppLink('http://127.0.0.1:5174/', owner)).search);
  assert.equal(restored.company_name, 'Avery Plumbing');
});

test('rejects malformed new-account input with the intended message', () => {
  assert.throws(() => createMockAccount({ ownerName: undefined, companyName: 'Example Co', email: 'owner@example.com' }), /Enter your name/);
});

test('turns Supabase authentication errors into useful sign-in guidance', () => {
  assert.equal(
    friendlyAuthError(new Error('Invalid login credentials')),
    'Email or password is incorrect. Try again or reset your password.',
  );
  assert.match(friendlyAuthError(new Error('Failed to fetch')), /could not reach the sign-in service/);
});

test('uses distinct live and local-demo password-reset confirmations', () => {
  assert.match(passwordResetConfirmation('john@example.com', true), /If john@example.com is registered/);
  assert.match(passwordResetConfirmation('john@example.com', false), /Demo only/);
});

test('carries account-scoped demo edits across different local app origins', () => {
  const originalWindow = globalThis.window;
  try {
    globalThis.window = { name: '', location: { search: '' } };
    const edited = {
      clients: [{ id: 'client_one', account_id: 'acct_northstar', name: 'One Client' }],
      jobs: [{ id: 'job_new', account_id: 'acct_northstar', client_id: 'client_one', scheduled_for: '2026-08-19' }],
    };
    saveMockAccountData('acct_northstar', edited);
    const link = buildMockDataLink('http://127.0.0.1:5173/?demo_user=john&account_id=acct_northstar');

    globalThis.window = { name: '', location: { search: new URL(link).search } };
    assert.deepEqual(loadMockAccountData('acct_northstar', { clients: [], jobs: [] }), edited);
    assert.ok(globalThis.window.name.includes('job_new'));
  } finally {
    globalThis.window = originalWindow;
  }
});

test('uses an account demo date unless the user explicitly previews today', () => {
  const account = { id: 'acct_demo', demo_reporting_date: '2026-08-19' };
  const demo = reportingDateFromAccount(account, '');
  assert.equal(demo.isoDate, '2026-08-19');
  assert.equal(demo.isDemoDate, true);

  const livePreview = reportingDateFromAccount(account, '?reporting_date=today');
  assert.equal(livePreview.isDemoDate, false);
  assert.equal(livePreview.storedDate, '2026-08-19');
});

test('carries the live-date preview between FieldFlow products', () => {
  const url = withReportingDate('http://127.0.0.1:5174/?account_id=acct_demo', {
    storedDate: '2026-08-19',
    isDemoDate: false,
  });
  assert.equal(new URL(url).searchParams.get('reporting_date'), 'today');
});

test('uses a safe user-facing label for unassigned jobs', () => {
  assert.equal(assigneeLabel(null), 'Unassigned');
  assert.equal(assigneeLabel(undefined), 'Unassigned');
  assert.equal(assigneeLabel('   '), 'Unassigned');
  assert.equal(assigneeLabel(' Maya Chen '), 'Maya Chen');
});
