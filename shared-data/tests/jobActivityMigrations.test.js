import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const migration = await readFile(new URL('../../supabase/migrations/012_job_activity_trigger_and_realtime.sql', import.meta.url), 'utf8');

test('activity migration records job changes and publishes Analytics-relevant data', () => {
  assert.match(migration, /create or replace function public\.log_job_activity/i);
  assert.match(migration, /after insert or update on public\.jobs/i);
  assert.match(migration, /alter publication supabase_realtime add table public\.jobs/i);
  assert.match(migration, /alter publication supabase_realtime add table public\.clients/i);
});
