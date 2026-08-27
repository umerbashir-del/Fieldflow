import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const jobsPath = path.join(root, 'shared-data', 'jobs.json');
const jobs = JSON.parse(await readFile(jobsPath, 'utf8'));
const jobsByWorkday = new Map();

for (const job of jobs) {
  const key = `${job.account_id}:${job.scheduled_for}`;
  if (!jobsByWorkday.has(key)) jobsByWorkday.set(key, []);
  jobsByWorkday.get(key).push(job);
}

for (const workdayJobs of jobsByWorkday.values()) {
  let nextStartMinutes = 8 * 60;
  for (const job of workdayJobs.sort((first, second) => first.id.localeCompare(second.id))) {
    if (!job.scheduled_start_time) {
      const hours = String(Math.floor(nextStartMinutes / 60)).padStart(2, '0');
      const minutes = String(nextStartMinutes % 60).padStart(2, '0');
      job.scheduled_start_time = `${hours}:${minutes}`;
    }
    nextStartMinutes += Math.max(Number(job.estimated_duration_minutes) || 60, 30) + 15;
  }
}

await writeFile(jobsPath, `${JSON.stringify(jobs, null, 2)}\n`);
console.log(`Ensured every one of ${jobs.length} jobs has a scheduled_start_time.`);
