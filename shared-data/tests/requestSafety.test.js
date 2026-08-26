import assert from 'node:assert/strict';
import test from 'node:test';
import { runAbortableRequest } from '../requestSafety.js';

test('returns a request result before its timeout', async () => {
  const result = await runAbortableRequest(async () => 'loaded', { timeoutMs: 50 });
  assert.equal(result, 'loaded');
});

test('aborts a slow request and returns a retry-safe timeout message', async () => {
  let aborted = false;
  await assert.rejects(
    runAbortableRequest((signal) => new Promise((_, reject) => {
      signal.addEventListener('abort', () => {
        aborted = true;
        reject(new Error('The underlying request was aborted.'));
      });
    }), { label: 'Jobs request', timeoutMs: 5 }),
    /Jobs request timed out and was cancelled/,
  );
  assert.equal(aborted, true);
});
