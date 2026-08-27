import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const jobs = JSON.parse(await readFile(new URL('../jobs.json', import.meta.url), 'utf8'));

test('every demo job has a valid scheduled start time', () => {
  assert.ok(jobs.length > 0);
  for (const job of jobs) {
    assert.match(job.scheduled_start_time, /^(?:[01]\d|2[0-3]):[0-5]\d$/, `${job.id} needs a valid scheduled_start_time`);
  }
});

test('jobs for the same account do not overlap on a workday', () => {
  const jobsByWorkday = new Map();
  for (const job of jobs) {
    const key = `${job.account_id}:${job.scheduled_for}`;
    if (!jobsByWorkday.has(key)) jobsByWorkday.set(key, []);
    jobsByWorkday.get(key).push(job);
  }

  for (const [workday, workdayJobs] of jobsByWorkday) {
    const orderedJobs = workdayJobs.sort((first, second) => first.scheduled_start_time.localeCompare(second.scheduled_start_time));
    for (let index = 1; index < orderedJobs.length; index += 1) {
      const previous = orderedJobs[index - 1];
      const current = orderedJobs[index];
      const [previousHours, previousMinutes] = previous.scheduled_start_time.split(':').map(Number);
      const [currentHours, currentMinutes] = current.scheduled_start_time.split(':').map(Number);
      const previousEndsAt = (previousHours * 60) + previousMinutes + (Number(previous.estimated_duration_minutes) || 60);
      const currentStartsAt = (currentHours * 60) + currentMinutes;
      assert.ok(currentStartsAt >= previousEndsAt, `${workday} has overlapping jobs: ${previous.id} and ${current.id}`);
    }
  }
});
