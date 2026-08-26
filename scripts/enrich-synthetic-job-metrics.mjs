import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const jobsPath = path.join(root, 'shared-data', 'jobs.json');
const syntheticAccountIds = new Set([
  'acct_brightspark', 'acct_clearview', 'acct_coastal', 'acct_greenscape', 'acct_horizon',
  'acct_ironclad', 'acct_northstar', 'acct_riverstone', 'acct_summitpaint', 'acct_truenorth',
]);
const categories = ['Repair', 'Maintenance', 'Installation', 'Inspection'];
const leadSources = ['Referral', 'Website', 'Google', 'Repeat client'];
const durations = [60, 90, 120, 180];

function stableNumber(value) {
  return [...value].reduce((total, character) => (total * 31 + character.charCodeAt(0)) >>> 0, 7);
}

const jobs = JSON.parse(await readFile(jobsPath, 'utf8'));
const enriched = jobs.map((job) => {
  if (!syntheticAccountIds.has(job.account_id)) return job;
  const value = stableNumber(job.id);
  const estimated = durations[value % durations.length];
  const isCompleted = job.status === 'completed';
  return {
    ...job,
    job_category: job.job_category ?? categories[value % categories.length],
    lead_source: job.lead_source ?? leadSources[value % leadSources.length],
    estimated_duration_minutes: job.estimated_duration_minutes ?? estimated,
    actual_duration_minutes: job.actual_duration_minutes ?? (isCompleted ? estimated + ((value % 3) - 1) * 15 : null),
    invoice_total: job.invoice_total ?? (isCompleted ? 145 + (value % 8) * 55 : null),
    completed_at: job.completed_at ?? (isCompleted ? `${job.scheduled_for}T17:00:00Z` : null),
    customer_satisfaction_rating: job.customer_satisfaction_rating ?? (isCompleted ? 3 + (value % 3) : null),
  };
});

await writeFile(jobsPath, `${JSON.stringify(enriched, null, 2)}\n`);
console.log(`Added deterministic optional metrics to ${enriched.filter((job) => syntheticAccountIds.has(job.account_id)).length} synthetic jobs.`);
