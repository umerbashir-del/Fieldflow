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

function validCustomPeriod(customRange) {
  if (!customRange?.start || !customRange?.end) return null;
  const start = toUtcDate(customRange.start);
  const end = new Date(toUtcDate(customRange.end).getTime() + DAY);
  const days = Math.round((end - start) / DAY);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || days < 1 || days > 90) return null;
  return { start, end, days };
}

export function buildAnalyticsSummary(jobs, accountId, timeframe, referenceDate = new Date(), customRange) {
  const thisWeekStart = startOfWeek(referenceDate);
  const periods = {
    this_week: { days: 7, start: thisWeekStart, label: 'This week', jobsLabel: 'Jobs this week', comparisonLabel: 'Previous week', granularity: 'day' },
    last_week: { days: 7, start: new Date(thisWeekStart.getTime() - 7 * DAY), label: 'Last week', jobsLabel: 'Jobs last week', comparisonLabel: 'Previous week', granularity: 'day' },
    last_two_weeks: { days: 14, start: new Date(thisWeekStart.getTime() - 7 * DAY), label: 'Last 2 weeks', jobsLabel: 'Jobs last 2 weeks', comparisonLabel: 'Previous 2 weeks', granularity: 'week' },
    last_three_weeks: { days: 21, start: new Date(thisWeekStart.getTime() - 14 * DAY), label: 'Last 3 weeks', jobsLabel: 'Jobs last 3 weeks', comparisonLabel: 'Previous 3 weeks', granularity: 'week' },
    last_four_weeks: { days: 28, start: new Date(thisWeekStart.getTime() - 3 * 7 * DAY), label: 'Last 4 weeks', jobsLabel: 'Jobs last 4 weeks', comparisonLabel: 'Previous 4 weeks', granularity: 'week' },
  };
  const customPeriod = timeframe === 'custom_range' ? validCustomPeriod(customRange) : null;
  const selectedPeriod = customPeriod
    ? { days: customPeriod.days, start: customPeriod.start, label: 'Custom range', jobsLabel: 'Jobs in selected range', comparisonLabel: 'Previous matching period', granularity: customPeriod.days <= 14 ? 'day' : 'week' }
    : periods[timeframe] ?? periods.this_week;
  const selectedEnd = customPeriod?.end ?? new Date(selectedPeriod.start.getTime() + selectedPeriod.days * DAY);
  const comparisonStart = new Date(selectedPeriod.start.getTime() - selectedPeriod.days * DAY);
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
    ? Array.from({ length: selectedPeriod.days }, (_, index) => {
      const dayStart = new Date(selectedPeriod.start.getTime() + index * DAY);
      const dayEnd = new Date(dayStart.getTime() + DAY);
      return { label: dayLabel(dayStart), detail: fullDateLabel(dayStart), start: dayStart, end: dayEnd, jobs: accountJobs.filter((job) => isInRange(job, dayStart, dayEnd)).length };
    })
    : Array.from({ length: Math.ceil(selectedPeriod.days / 7) }, (_, index) => {
      const weekStart = new Date(selectedPeriod.start.getTime() + index * 7 * DAY);
      const weekEnd = new Date(Math.min(weekStart.getTime() + 7 * DAY, selectedEnd.getTime()));
      return { label: weekLabel(weekStart), detail: rangeLabel(weekStart, weekEnd), start: weekStart, end: weekEnd, jobs: accountJobs.filter((job) => isInRange(job, weekStart, weekEnd)).length };
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

export function buildAnalyticsInsights({ jobs, clients, activities = [], accountId, summary, referenceDate, inactiveDays = 30 }) {
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
  const referenceDay = new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), referenceDate.getUTCDate() + 1));
  const inactivityCutoff = new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), referenceDate.getUTCDate() - inactiveDays));
  const inactiveClients = accountClients.filter((client) => {
    const latestJob = accountJobs
      .filter((job) => job.client_id === client.id && job.status !== 'cancelled' && toUtcDate(job.scheduled_for) < referenceDay)
      .reduce((latest, job) => !latest || toUtcDate(job.scheduled_for) > latest ? toUtcDate(job.scheduled_for) : latest, null);
    return latestJob !== null && latestJob < inactivityCutoff;
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
  const revenueTrend = summary.trend.map((point) => {
    const pointStart = point.start ?? selectedStart;
    const pointEnd = point.end ?? selectedStart;
    const value = accountJobs.filter((job) => job.status === 'completed' && isInRange(job, pointStart, pointEnd))
      .reduce((total, job) => total + (Number.isFinite(Number(job.invoice_total)) ? Number(job.invoice_total) : 0), 0);
    return { ...point, value: Number(value.toFixed(2)) };
  });
  const jobById = new Map(accountJobs.map((job) => [job.id, job]));
  const activityCutoff = new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), referenceDate.getUTCDate() + 1));
  const recentActivity = activities.filter((activity) => activity.account_id === accountId && new Date(activity.occurred_at) < activityCutoff)
    .sort((first, second) => second.occurred_at.localeCompare(first.occurred_at)).slice(0, 5)
    .map((activity) => ({ ...activity, clientName: clientNames.get(jobById.get(activity.job_id)?.client_id) ?? 'Unknown client' }));

  return {
    statusBreakdown,
    completionRate,
    busiestPoint: busiestPoint?.jobs ? busiestPoint : null,
    upcomingJobs,
    workload,
    topClients,
    inactiveClients,
    recentScheduledJobs,
    recentActivity,
    inactiveDays,
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
      revenueTrend,
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
