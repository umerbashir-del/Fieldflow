import assert from 'node:assert/strict';
import test from 'node:test';
import { authenticateMockUser, buildMockAppLink, createMockAccount, mockUserFromSearch } from '../../shared-data/mockSession.js';

test('maps John and Sarah to separate demo accounts', () => {
  assert.equal(authenticateMockUser('john@fieldflow.demo', 'john-demo-password').account_id, 'acct_northstar');
  assert.equal(authenticateMockUser('sarah@fieldflow.demo', 'sarah-demo-password').account_id, 'acct_horizon');
});

test('maps the separate Operations demo account to the ops role', () => {
  const ops = authenticateMockUser('ops@fieldflow.demo', 'ops-demo-password');
  assert.equal(ops.role, 'ops');
  assert.equal(ops.account_id, undefined);
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
