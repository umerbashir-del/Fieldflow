import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { buildAnalyticsInsights, buildAnalyticsSummary, buildSchedulingLink, changePresentation, chatSummaryText } from '../src/analyticsSummary.js';

const jobs = JSON.parse(await readFile(new URL('../../shared-data/jobs.json', import.meta.url), 'utf8'));
const accounts = JSON.parse(await readFile(new URL('../../shared-data/accounts.json', import.meta.url), 'utf8'));
const clients = JSON.parse(await readFile(new URL('../../shared-data/clients.json', import.meta.url), 'utf8'));
const ACCOUNT_ID = 'acct_northstar';
const REFERENCE_DATE = new Date('2026-08-19T12:00:00Z');

test('gives every demo account valid canonical job activity', () => {
  const clientKeys = new Set(clients.map((client) => `${client.account_id}:${client.id}`));
  const allowedStatuses = new Set(['scheduled', 'in_progress', 'completed', 'cancelled']);
  assert.deepEqual([...new Set(jobs.map((job) => job.id))].length, jobs.length);
  for (const account of accounts) {
    assert.ok(jobs.some((job) => job.account_id === account.id), `${account.id} should have demo jobs`);
  }
  for (const job of jobs) {
    assert.ok(clientKeys.has(`${job.account_id}:${job.client_id}`), `${job.id} should reference a client in its account`);
    assert.ok(allowedStatuses.has(job.status), `${job.id} should use a canonical status`);
  }
});

test('calculates the current weekly MVP summary from shared job data', () => {
  const summary = buildAnalyticsSummary(jobs, ACCOUNT_ID, 'this_week', REFERENCE_DATE);

  assert.equal(summary.selectedJobs.length, 14);
  assert.equal(summary.comparisonJobs.length, 11);
  assert.equal(summary.change, 27);
  assert.equal(summary.hasCompleteComparison, true);
  assert.equal(summary.newClients, 5);
  assert.equal(summary.repeatClients, 4);
  assert.equal(summary.selectedRangeLabel, 'Aug 17–23');
  assert.equal(summary.comparisonRangeLabel, 'Aug 10–16');
  assert.deepEqual(summary.trend.map((day) => day.jobs), [2, 2, 2, 3, 2, 2, 1]);
  assert.equal(summary.trend[0].detail, 'Aug 17, 2026');
});

test('returns the expected four-week job trend', () => {
  const summary = buildAnalyticsSummary(jobs, ACCOUNT_ID, 'last_four_weeks', REFERENCE_DATE);

  assert.deepEqual(summary.trend.map((week) => week.jobs), [8, 10, 11, 14]);
  assert.equal(summary.selectedJobs.length, 43);
  assert.equal(summary.trend[0].detail, 'Jul 27–Aug 2');
});

test('updates totals when the user selects last week', () => {
  const summary = buildAnalyticsSummary(jobs, ACCOUNT_ID, 'last_week', REFERENCE_DATE);

  assert.equal(summary.selectedPeriod.label, 'Last week');
  assert.equal(summary.selectedJobs.length, 11);
  assert.equal(summary.comparisonJobs.length, 10);
  assert.equal(summary.change, 10);
  assert.equal(summary.selectedRangeLabel, 'Aug 10–16');
  assert.equal(summary.comparisonRangeLabel, 'Aug 3–9');
  assert.deepEqual(summary.trend.map((day) => day.jobs), [2, 1, 2, 1, 2, 1, 2]);
});

test('uses weekly points for the two- and three-week views', () => {
  const twoWeeks = buildAnalyticsSummary(jobs, ACCOUNT_ID, 'last_two_weeks', REFERENCE_DATE);
  const threeWeeks = buildAnalyticsSummary(jobs, ACCOUNT_ID, 'last_three_weeks', REFERENCE_DATE);

  assert.deepEqual(twoWeeks.trend.map((week) => week.jobs), [11, 14]);
  assert.deepEqual(threeWeeks.trend.map((week) => week.jobs), [10, 11, 14]);
  assert.equal(twoWeeks.hasCompleteComparison, true);
  assert.equal(threeWeeks.hasCompleteComparison, true);
  assert.equal(threeWeeks.selectedRangeLabel, 'Aug 3–23');
  assert.equal(threeWeeks.comparisonRangeLabel, 'Jul 13–Aug 2');
});

test('has enough earlier data to compare the four-week view fairly', () => {
  const summary = buildAnalyticsSummary(jobs, ACCOUNT_ID, 'last_four_weeks', REFERENCE_DATE);

  assert.equal(summary.hasCompleteComparison, true);
  assert.equal(summary.comparisonJobs.length, 30);
  assert.equal(summary.change, 43);
});

test('does not include jobs from another account', () => {
  const summary = buildAnalyticsSummary(jobs, ACCOUNT_ID, 'this_week', REFERENCE_DATE);

  assert.ok(summary.selectedJobs.every((job) => job.account_id === ACCOUNT_ID));
  assert.equal(summary.selectedJobs.some((job) => job.id === 'job_203'), false);
});

test('handles a period with no jobs and no comparison period', () => {
  const summary = buildAnalyticsSummary([], ACCOUNT_ID, 'this_week', REFERENCE_DATE);

  assert.equal(summary.selectedJobs.length, 0);
  assert.equal(summary.comparisonJobs.length, 0);
  assert.equal(summary.change, null);
  assert.equal(summary.hasCompleteComparison, false);
  assert.equal(summary.newClients, 0);
  assert.equal(summary.repeatClients, 0);
  assert.deepEqual(summary.trend.map((day) => day.jobs), [0, 0, 0, 0, 0, 0, 0]);
});

test('counts cancelled jobs consistently in the scheduled-job total', () => {
  const cancelledJob = [{ id: 'job_test', account_id: ACCOUNT_ID, client_id: 'client_test', scheduled_for: '2026-08-18', status: 'cancelled' }];
  const summary = buildAnalyticsSummary(cancelledJob, ACCOUNT_ID, 'this_week', REFERENCE_DATE);

  assert.equal(summary.selectedJobs.length, 1);
});

test('creates a Scheduling handoff link with the selected period', () => {
  const summary = buildAnalyticsSummary(jobs, ACCOUNT_ID, 'this_week', REFERENCE_DATE);
  const link = new URL(buildSchedulingLink('http://127.0.0.1:5174/', ACCOUNT_ID, summary.selectedPeriod.start, summary.selectedEnd));

  assert.equal(link.searchParams.get('account_id'), ACCOUNT_ID);
  assert.equal(link.searchParams.get('start'), '2026-08-17');
  assert.equal(link.searchParams.get('end'), '2026-08-24');
});

test('creates a readable Chat summary from the selected period', () => {
  const summary = buildAnalyticsSummary(jobs, ACCOUNT_ID, 'this_week', REFERENCE_DATE);

  assert.equal(
    chatSummaryText('Northstar Field Services', summary),
    'Northstar Field Services: This week. 14 jobs, 11 in the previous period, +27% compared with the previous period. 5 new clients and 4 repeat clients.',
  );
});

test('keeps Monday and Sunday in the selected week and excludes the next Monday', () => {
  const boundaryJobs = [
    { id: 'monday', account_id: ACCOUNT_ID, client_id: 'a', scheduled_for: '2026-12-28', status: 'scheduled' },
    { id: 'sunday', account_id: ACCOUNT_ID, client_id: 'b', scheduled_for: '2027-01-03', status: 'scheduled' },
    { id: 'next-monday', account_id: ACCOUNT_ID, client_id: 'c', scheduled_for: '2027-01-04', status: 'scheduled' },
  ];
  const summary = buildAnalyticsSummary(boundaryJobs, ACCOUNT_ID, 'this_week', new Date('2027-01-01T18:00:00Z'));

  assert.deepEqual(summary.selectedJobs.map((job) => job.id), ['monday', 'sunday']);
  assert.equal(summary.selectedRangeLabel, 'Dec 28–Jan 3');
});

test('uses UTC calendar dates consistently across daylight-saving transitions', () => {
  const daylightJobs = [
    { id: 'before-dst', account_id: ACCOUNT_ID, client_id: 'a', scheduled_for: '2026-03-02', status: 'scheduled' },
    { id: 'dst-sunday', account_id: ACCOUNT_ID, client_id: 'b', scheduled_for: '2026-03-08', status: 'scheduled' },
  ];
  const summary = buildAnalyticsSummary(daylightJobs, ACCOUNT_ID, 'this_week', new Date('2026-03-08T12:00:00-04:00'));

  assert.deepEqual(summary.trend.map((day) => day.jobs), [1, 0, 0, 0, 0, 0, 1]);
});

test('counts each client once and classifies prior clients as repeat', () => {
  const clientJobs = [
    { id: 'prior', account_id: ACCOUNT_ID, client_id: 'repeat', scheduled_for: '2026-08-10', status: 'completed' },
    { id: 'repeat-one', account_id: ACCOUNT_ID, client_id: 'repeat', scheduled_for: '2026-08-17', status: 'scheduled' },
    { id: 'repeat-two', account_id: ACCOUNT_ID, client_id: 'repeat', scheduled_for: '2026-08-18', status: 'scheduled' },
    { id: 'new-one', account_id: ACCOUNT_ID, client_id: 'new', scheduled_for: '2026-08-19', status: 'cancelled' },
  ];
  const summary = buildAnalyticsSummary(clientJobs, ACCOUNT_ID, 'this_week', REFERENCE_DATE);

  assert.equal(summary.newClients, 1);
  assert.equal(summary.repeatClients, 1);
  assert.equal(summary.selectedJobs.length, 3);
});

test('reports a zero-job selected period against a populated comparison period', () => {
  const comparisonOnly = [
    { id: 'comparison', account_id: ACCOUNT_ID, client_id: 'prior', scheduled_for: '2026-08-10', status: 'completed' },
  ];
  const summary = buildAnalyticsSummary(comparisonOnly, ACCOUNT_ID, 'this_week', REFERENCE_DATE);

  assert.equal(summary.selectedJobs.length, 0);
  assert.equal(summary.comparisonJobs.length, 1);
  assert.equal(summary.change, -100);
  assert.deepEqual(
    changePresentation({ selectedJobs: 0, comparisonJobs: 1, change: summary.change, hasCompleteComparison: true, comparisonRangeLabel: 'Previous week' }),
    { value: 'No jobs scheduled', detail: 'Previous period: 1 job', tone: 'neutral' },
  );
});

test('calculates an exact custom date range and a matching previous period', () => {
  const summary = buildAnalyticsSummary(jobs, ACCOUNT_ID, 'custom_range', REFERENCE_DATE, {
    start: '2026-08-10', end: '2026-08-16',
  });

  assert.equal(summary.selectedPeriod.label, 'Custom range');
  assert.equal(summary.selectedRangeLabel, 'Aug 10–16');
  assert.equal(summary.comparisonRangeLabel, 'Aug 3–9');
  assert.equal(summary.selectedJobs.length, 11);
  assert.equal(summary.comparisonJobs.length, 10);
  assert.equal(summary.trend.length, 7);
});

test('uses weekly chart points for a custom range longer than two weeks', () => {
  const summary = buildAnalyticsSummary(jobs, ACCOUNT_ID, 'custom_range', REFERENCE_DATE, {
    start: '2026-07-27', end: '2026-08-23',
  });

  assert.equal(summary.trend.length, 4);
  assert.deepEqual(summary.trend.map((point) => point.jobs), [8, 10, 11, 14]);
});

test('falls back safely when a custom range is incomplete or too long', () => {
  const incomplete = buildAnalyticsSummary(jobs, ACCOUNT_ID, 'custom_range', REFERENCE_DATE, { start: '2026-08-10', end: '' });
  const tooLong = buildAnalyticsSummary(jobs, ACCOUNT_ID, 'custom_range', REFERENCE_DATE, { start: '2026-01-01', end: '2026-05-01' });

  assert.equal(incomplete.selectedPeriod.label, 'This week');
  assert.equal(tooLong.selectedPeriod.label, 'This week');
});

test('builds selectable job, client, and workload insights from the same account data', () => {
  const summary = buildAnalyticsSummary(jobs, ACCOUNT_ID, 'this_week', REFERENCE_DATE);
  const insights = buildAnalyticsInsights({ jobs, clients, accountId: ACCOUNT_ID, summary, referenceDate: REFERENCE_DATE });

  assert.equal(insights.statusBreakdown.reduce((total, item) => total + item.jobs, 0), summary.selectedJobs.length);
  assert.equal(insights.completionRate, Math.round((insights.statusBreakdown.find((item) => item.status === 'completed').jobs / summary.selectedJobs.length) * 100));
  assert.ok(insights.busiestPoint.jobs > 0);
  assert.ok(insights.upcomingJobs.every((job) => job.account_id === ACCOUNT_ID));
  assert.ok(insights.workload.every((item) => item.assignee));
  assert.ok(insights.topClients.every((item) => item.name && item.jobs > 0));
  assert.ok(insights.inactiveClients.every((client) => client.account_id === ACCOUNT_ID));
  assert.ok(insights.recentScheduledJobs.every((job) => job.account_id === ACCOUNT_ID));
  assert.ok(insights.performance.completedJobs >= insights.performance.invoicedJobs);
  assert.ok(insights.performance.invoiceTotal >= 0);
  assert.ok(insights.performance.categoryPerformance.every((item) => item.category && item.jobs > 0));
});

test('gives insight views safe empty values for a company with no work', () => {
  const summary = buildAnalyticsSummary([], ACCOUNT_ID, 'this_week', REFERENCE_DATE);
  const insights = buildAnalyticsInsights({ jobs: [], clients: [], accountId: ACCOUNT_ID, summary, referenceDate: REFERENCE_DATE });

  assert.deepEqual(insights.statusBreakdown.map((item) => item.jobs), [0, 0, 0, 0]);
  assert.equal(insights.completionRate, null);
  assert.equal(insights.busiestPoint, null);
  assert.deepEqual(insights.upcomingJobs, []);
  assert.deepEqual(insights.workload, []);
  assert.deepEqual(insights.topClients, []);
  assert.equal(insights.performance.invoiceTotal, 0);
  assert.equal(insights.performance.averageInvoice, null);
  assert.equal(insights.performance.averageRating, null);
});

test('does not let cancelled or future work keep a client active', () => {
  const clientRecords = [
    { id: 'past-client', account_id: ACCOUNT_ID, name: 'Past client' },
    { id: 'future-client', account_id: ACCOUNT_ID, name: 'Future client' },
    { id: 'cancelled-client', account_id: ACCOUNT_ID, name: 'Cancelled client' },
  ];
  const clientJobs = [
    { id: 'past-job', account_id: ACCOUNT_ID, client_id: 'past-client', scheduled_for: '2026-06-01', status: 'completed' },
    { id: 'future-job', account_id: ACCOUNT_ID, client_id: 'future-client', scheduled_for: '2026-09-01', status: 'scheduled' },
    { id: 'cancelled-job', account_id: ACCOUNT_ID, client_id: 'cancelled-client', scheduled_for: '2026-06-01', status: 'cancelled' },
  ];
  const summary = buildAnalyticsSummary(clientJobs, ACCOUNT_ID, 'this_week', REFERENCE_DATE);
  const insights = buildAnalyticsInsights({ jobs: clientJobs, clients: clientRecords, accountId: ACCOUNT_ID, summary, referenceDate: REFERENCE_DATE, inactiveDays: 30 });

  assert.deepEqual(insights.inactiveClients.map((client) => client.id), ['past-client']);
});

test('uses completed invoice values only and reads real activity in reverse date order', () => {
  const clientRecords = [{ id: 'client-a', account_id: ACCOUNT_ID, name: 'Avery Plumbing' }];
  const clientJobs = [
    { id: 'complete', account_id: ACCOUNT_ID, client_id: 'client-a', scheduled_for: '2026-08-18', status: 'completed', invoice_total: 240 },
    { id: 'scheduled', account_id: ACCOUNT_ID, client_id: 'client-a', scheduled_for: '2026-08-19', status: 'scheduled', invoice_total: 900 },
    { id: 'cancelled', account_id: ACCOUNT_ID, client_id: 'client-a', scheduled_for: '2026-08-20', status: 'cancelled', invoice_total: 700 },
  ];
  const activities = [
    { id: 'older', account_id: ACCOUNT_ID, job_id: 'complete', occurred_at: '2026-08-18T12:00:00Z', detail: 'Job marked completed' },
    { id: 'newer', account_id: ACCOUNT_ID, job_id: 'scheduled', occurred_at: '2026-08-19T14:00:00Z', detail: 'Job rescheduled' },
    { id: 'future', account_id: ACCOUNT_ID, job_id: 'scheduled', occurred_at: '2026-09-01T14:00:00Z', detail: 'Future activity' },
  ];
  const summary = buildAnalyticsSummary(clientJobs, ACCOUNT_ID, 'this_week', REFERENCE_DATE);
  const insights = buildAnalyticsInsights({ jobs: clientJobs, clients: clientRecords, activities, accountId: ACCOUNT_ID, summary, referenceDate: REFERENCE_DATE });

  assert.equal(insights.performance.invoiceTotal, 240);
  assert.deepEqual(insights.recentActivity.map((activity) => activity.id), ['newer', 'older']);
  assert.ok(insights.performance.revenueTrend.every((point) => point.value <= 240));
});

test('describes positive, negative, unchanged, and unavailable comparisons in plain language', () => {
  assert.equal(changePresentation({ selectedJobs: 14, comparisonJobs: 11, change: 27, hasCompleteComparison: true, comparisonRangeLabel: 'Previous week' }).value, 'Up 27%');
  assert.equal(changePresentation({ selectedJobs: 10, comparisonJobs: 14, change: -29, hasCompleteComparison: true, comparisonRangeLabel: 'Previous week' }).value, 'Down 29%');
  assert.equal(changePresentation({ selectedJobs: 10, comparisonJobs: 10, change: 0, hasCompleteComparison: true, comparisonRangeLabel: 'Previous week' }).value, 'No change');
  assert.equal(changePresentation({ selectedJobs: 4, comparisonJobs: 0, change: null, hasCompleteComparison: false, comparisonRangeLabel: 'Previous week' }).value, 'Comparison unavailable');
});

test('calculates a large account dataset within the performance budget', () => {
  const largeJobs = Array.from({ length: 10_000 }, (_, index) => ({
    id: `load-${index}`,
    account_id: ACCOUNT_ID,
    client_id: `client-${index % 500}`,
    scheduled_for: `2026-08-${String((index % 28) + 1).padStart(2, '0')}`,
    status: index % 4 === 0 ? 'cancelled' : 'scheduled',
  }));
  const started = performance.now();
  const summary = buildAnalyticsSummary(largeJobs, ACCOUNT_ID, 'last_four_weeks', REFERENCE_DATE);

  assert.equal(summary.selectedJobs.length + summary.comparisonJobs.length > 0, true);
  assert.equal(summary.trend.length, 4);
  assert.ok(performance.now() - started < 500, '10,000-job summary exceeded 500 ms');
});
