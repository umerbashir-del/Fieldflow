const DAY = 24 * 60 * 60 * 1000;

function toUtcDate(isoDate) {
  return new Date(`${isoDate}T00:00:00Z`);
}

function startOfWeek(date) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  return start;
}

function isInRange(job, start, end) {
  const scheduledDate = toUtcDate(job.scheduled_for);
  return scheduledDate >= start && scheduledDate < end;
}

function weekLabel(weekStart) {
  return weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function dayLabel(day) {
  return day.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
}

function fullDateLabel(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

function rangeLabel(start, exclusiveEnd) {
  const end = new Date(exclusiveEnd.getTime() - DAY);
  const sameMonth = start.getUTCFullYear() === end.getUTCFullYear() && start.getUTCMonth() === end.getUTCMonth();
  const startLabel = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const endLabel = end.toLocaleDateString('en-US', { month: sameMonth ? undefined : 'short', day: 'numeric', timeZone: 'UTC' });
  return `${startLabel}–${endLabel}`;
}

export function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

export function buildAnalyticsSummary(jobs, accountId, timeframe, referenceDate = new Date()) {
  const thisWeekStart = startOfWeek(referenceDate);
  const periods = {
    this_week: { weeks: 1, start: thisWeekStart, label: 'This week', jobsLabel: 'Jobs this week', comparisonLabel: 'Previous week', granularity: 'day' },
    last_week: { weeks: 1, start: new Date(thisWeekStart.getTime() - 7 * DAY), label: 'Last week', jobsLabel: 'Jobs last week', comparisonLabel: 'Previous week', granularity: 'day' },
    last_two_weeks: { weeks: 2, start: new Date(thisWeekStart.getTime() - 7 * DAY), label: 'Last 2 weeks', jobsLabel: 'Jobs last 2 weeks', comparisonLabel: 'Previous 2 weeks', granularity: 'week' },
    last_three_weeks: { weeks: 3, start: new Date(thisWeekStart.getTime() - 14 * DAY), label: 'Last 3 weeks', jobsLabel: 'Jobs last 3 weeks', comparisonLabel: 'Previous 3 weeks', granularity: 'week' },
    last_four_weeks: { weeks: 4, start: new Date(thisWeekStart.getTime() - 3 * 7 * DAY), label: 'Last 4 weeks', jobsLabel: 'Jobs last 4 weeks', comparisonLabel: 'Previous 4 weeks', granularity: 'week' },
  };
  const selectedPeriod = periods[timeframe] ?? periods.this_week;
  const selectedEnd = new Date(selectedPeriod.start.getTime() + selectedPeriod.weeks * 7 * DAY);
  const comparisonStart = new Date(selectedPeriod.start.getTime() - selectedPeriod.weeks * 7 * DAY);
  const accountJobs = jobs.filter((job) => job.account_id === accountId);
  const selectedJobs = accountJobs.filter((job) => isInRange(job, selectedPeriod.start, selectedEnd));
  const comparisonJobs = accountJobs.filter((job) => isInRange(job, comparisonStart, selectedPeriod.start));
  const change = comparisonJobs.length === 0 ? null : Math.round(((selectedJobs.length - comparisonJobs.length) / comparisonJobs.length) * 100);
  const earliestJobDate = accountJobs.reduce((earliest, job) => {
    const scheduledDate = toUtcDate(job.scheduled_for);
    return !earliest || scheduledDate < earliest ? scheduledDate : earliest;
  }, null);
  const hasCompleteComparison = earliestJobDate !== null && earliestJobDate <= comparisonStart;
  const priorClientIds = new Set(accountJobs.filter((job) => toUtcDate(job.scheduled_for) < selectedPeriod.start).map((job) => job.client_id));
  const selectedClientIds = new Set(selectedJobs.map((job) => job.client_id));
  const newClients = [...selectedClientIds].filter((clientId) => !priorClientIds.has(clientId)).length;
  const repeatClients = [...selectedClientIds].filter((clientId) => priorClientIds.has(clientId)).length;
  const trend = selectedPeriod.granularity === 'day'
    ? Array.from({ length: 7 }, (_, index) => {
      const dayStart = new Date(selectedPeriod.start.getTime() + index * DAY);
      return { label: dayLabel(dayStart), detail: fullDateLabel(dayStart), jobs: accountJobs.filter((job) => isInRange(job, dayStart, new Date(dayStart.getTime() + DAY))).length };
    })
    : Array.from({ length: selectedPeriod.weeks }, (_, index) => {
      const weekStart = new Date(selectedPeriod.start.getTime() + index * 7 * DAY);
      return { label: weekLabel(weekStart), detail: rangeLabel(weekStart, new Date(weekStart.getTime() + 7 * DAY)), jobs: accountJobs.filter((job) => isInRange(job, weekStart, new Date(weekStart.getTime() + 7 * DAY))).length };
    });

  return {
    selectedPeriod,
    selectedEnd,
    selectedRangeLabel: rangeLabel(selectedPeriod.start, selectedEnd),
    comparisonRangeLabel: rangeLabel(comparisonStart, selectedPeriod.start),
    selectedJobs,
    comparisonJobs,
    change,
    hasCompleteComparison,
    newClients,
    repeatClients,
    trend,
  };
}

export function chatSummaryText(accountName, summary) {
  const changeText = !summary.hasCompleteComparison
    ? 'There is not enough earlier data for a fair comparison.'
    : summary.change === null ? 'There is no earlier period to compare.' : `${summary.change > 0 ? '+' : ''}${summary.change}% compared with the previous period.`;
  return `${accountName}: ${summary.selectedPeriod.label}. ${summary.selectedJobs.length} jobs, ${summary.comparisonJobs.length} in the previous period, ${changeText} ${summary.newClients} new clients and ${summary.repeatClients} repeat clients.`;
}

export function buildSchedulingLink(baseUrl, accountId, start, end) {
  const url = new URL(baseUrl);
  url.searchParams.set('account_id', accountId);
  url.searchParams.set('start', toIsoDate(start));
  url.searchParams.set('end', toIsoDate(end));
  return url.toString();
}
