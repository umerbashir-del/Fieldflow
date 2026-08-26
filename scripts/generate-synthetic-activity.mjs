import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const jobs = JSON.parse(await readFile(path.join(root, 'shared-data', 'jobs.json'), 'utf8'));
const activities = jobs.flatMap((job) => {
  const date = new Date(`${job.scheduled_for}T09:00:00Z`);
  const created = new Date(date.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString();
  const base = [{ id: `act_${job.id}_scheduled`, account_id: job.account_id, job_id: job.id, activity_type: 'scheduled', occurred_at: created, detail: 'Job scheduled' }];
  if (job.status === 'completed') base.push({ id: `act_${job.id}_completed`, account_id: job.account_id, job_id: job.id, activity_type: 'completed', occurred_at: `${job.scheduled_for}T17:00:00Z`, detail: 'Job marked completed' });
  if (job.status === 'cancelled') base.push({ id: `act_${job.id}_cancelled`, account_id: job.account_id, job_id: job.id, activity_type: 'cancelled', occurred_at: `${job.scheduled_for}T12:00:00Z`, detail: 'Job cancelled' });
  return base;
});
await writeFile(path.join(root, 'shared-data', 'job-activity.json'), `${JSON.stringify(activities, null, 2)}\n`);
console.log(`Generated ${activities.length} synthetic job-activity records.`);
