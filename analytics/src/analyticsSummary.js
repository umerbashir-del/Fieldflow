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

export function changePresentation({ selectedJobs, comparisonJobs, change, hasCompleteComparison, comparisonRangeLabel }) {
  if (selectedJobs === 0) {
    return {
      value: 'No jobs scheduled',
      detail: comparisonJobs > 0
        ? `Previous period: ${comparisonJobs} job${comparisonJobs === 1 ? '' : 's'}`
        : 'No jobs in the previous period either.',
      tone: 'neutral',
    };
  }
  if (!hasCompleteComparison) {
    return { value: 'Comparison unavailable', detail: 'Not enough earlier data for a fair comparison.', tone: 'neutral' };
  }
  if (change === null) {
    return { value: 'No earlier jobs to compare', detail: `This period: ${selectedJobs} job${selectedJobs === 1 ? '' : 's'}`, tone: 'neutral' };
  }
  if (change > 0) {
    return { value: `Up ${change}%`, detail: `${selectedJobs} jobs vs. ${comparisonJobs} in ${comparisonRangeLabel}`, tone: 'positive' };
  }
  if (change < 0) {
    return { value: `Down ${Math.abs(change)}%`, detail: `${selectedJobs} jobs vs. ${comparisonJobs} in ${comparisonRangeLabel}`, tone: 'negative' };
  }
  return { value: 'No change', detail: `${selectedJobs} jobs in both periods`, tone: 'neutral' };
}

const STATUS_ORDER = ['scheduled', 'in_progress', 'completed', 'cancelled'];
const STATUS_LABELS = {
  scheduled: 'Scheduled',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export function buildAnalyticsInsights({ jobs, clients, accountId, summary, referenceDate }) {
  const accountJobs = jobs.filter((job) => job.account_id === accountId);
  const accountClients = clients.filter((client) => client.account_id === accountId);
  const clientNames = new Map(accountClients.map((client) => [client.id, client.name]));
  const selectedJobs = summary.selectedJobs;
  const selectedClientIds = new Set(selectedJobs.map((job) => job.client_id));
  const selectedStart = summary.selectedPeriod.start;
  const statusBreakdown = STATUS_ORDER.map((status) => ({
    status,
    label: STATUS_LABELS[status],
    jobs: selectedJobs.filter((job) => job.status === status).length,
  }));
  const completionRate = selectedJobs.length
    ? Math.round((statusBreakdown.find((item) => item.status === 'completed').jobs / selectedJobs.length) * 100)
    : null;
  const busiestPoint = summary.trend.reduce((busiest, point) => point.jobs > (busiest?.jobs ?? 0) ? point : busiest, null);
  const earliestSelectedDate = toIsoDate(referenceDate);
  const upcomingJobs = accountJobs
    .filter((job) => job.scheduled_for >= earliestSelectedDate && !['completed', 'cancelled'].includes(job.status))
    .sort((first, second) => first.scheduled_for.localeCompare(second.scheduled_for))
    .slice(0, 5)
    .map((job) => ({ ...job, clientName: clientNames.get(job.client_id) ?? 'Unknown client', assigneeLabel: job.assignee || 'Unassigned' }));
  const workload = [...selectedJobs.reduce((groups, job) => {
    const assignee = job.assignee || 'Unassigned';
    groups.set(assignee, (groups.get(assignee) ?? 0) + 1);
    return groups;
  }, new Map()).entries()]
    .map(([assignee, jobs]) => ({ assignee, jobs }))
    .sort((first, second) => second.jobs - first.jobs || first.assignee.localeCompare(second.assignee));
  const topClients = [...selectedJobs.reduce((groups, job) => {
    groups.set(job.client_id, (groups.get(job.client_id) ?? 0) + 1);
    return groups;
  }, new Map()).entries()]
    .map(([clientId, jobs]) => ({ clientId, name: clientNames.get(clientId) ?? 'Unknown client', jobs }))
    .sort((first, second) => second.jobs - first.jobs || first.name.localeCompare(second.name))
    .slice(0, 5);
  const inactiveClients = accountClients.filter((client) => {
    if (selectedClientIds.has(client.id)) return false;
    return accountJobs.some((job) => job.client_id === client.id && toUtcDate(job.scheduled_for) < selectedStart);
  });
  const recentScheduledJobs = [...accountJobs]
    .sort((first, second) => second.scheduled_for.localeCompare(first.scheduled_for))
    .slice(0, 5)
    .map((job) => ({ ...job, clientName: clientNames.get(job.client_id) ?? 'Unknown client', assigneeLabel: job.assignee || 'Unassigned' }));
  const completedJobs = selectedJobs.filter((job) => job.status === 'completed');
  const invoicedJobs = completedJobs.filter((job) => Number.isFinite(Number(job.invoice_total)));
  const invoiceTotal = Number(invoicedJobs.reduce((total, job) => total + Number(job.invoice_total), 0).toFixed(2));
  const durationJobs = completedJobs.filter((job) => Number.isFinite(Number(job.estimated_duration_minutes)) && Number.isFinite(Number(job.actual_duration_minutes)));
  const averageEstimatedMinutes = durationJobs.length ? Math.round(durationJobs.reduce((total, job) => total + Number(job.estimated_duration_minutes), 0) / durationJobs.length) : null;
  const averageActualMinutes = durationJobs.length ? Math.round(durationJobs.reduce((total, job) => total + Number(job.actual_duration_minutes), 0) / durationJobs.length) : null;
  const ratedJobs = completedJobs.filter((job) => Number.isFinite(Number(job.customer_satisfaction_rating)));
  const averageRating = ratedJobs.length ? Number((ratedJobs.reduce((total, job) => total + Number(job.customer_satisfaction_rating), 0) / ratedJobs.length).toFixed(1)) : null;
  const categoryPerformance = [...selectedJobs.reduce((groups, job) => {
    const category = job.job_category || 'Uncategorized';
    const current = groups.get(category) ?? { category, jobs: 0, invoiceTotal: 0 };
    current.jobs += 1;
    if (job.status === 'completed' && Number.isFinite(Number(job.invoice_total))) current.invoiceTotal += Number(job.invoice_total);
    groups.set(category, current);
    return groups;
  }, new Map()).values()]
    .map((item) => ({ ...item, invoiceTotal: Number(item.invoiceTotal.toFixed(2)) }))
    .sort((first, second) => second.invoiceTotal - first.invoiceTotal || second.jobs - first.jobs || first.category.localeCompare(second.category));

  return {
    statusBreakdown,
    completionRate,
    busiestPoint: busiestPoint?.jobs ? busiestPoint : null,
    upcomingJobs,
    workload,
    topClients,
    inactiveClients,
    recentScheduledJobs,
    performance: {
      completedJobs: completedJobs.length,
      invoicedJobs: invoicedJobs.length,
      invoiceTotal,
      averageInvoice: invoicedJobs.length ? Number((invoiceTotal / invoicedJobs.length).toFixed(2)) : null,
      averageEstimatedMinutes,
      averageActualMinutes,
      averageRating,
      ratedJobs: ratedJobs.length,
      categoryPerformance,
    },
  };
}

export function buildSchedulingLink(baseUrl, accountId, start, end) {
  const url = new URL(baseUrl);
  url.searchParams.set('account_id', accountId);
  url.searchParams.set('start', toIsoDate(start));
  url.searchParams.set('end', toIsoDate(end));
  return url.toString();
}
