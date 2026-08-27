import { useEffect, useState } from 'react';
import { getAccountById, getAnalyticsSummary, getClientsForAccount, getJobActivityForAccount, getJobsForAccount, getOperationsSession, getSignedInAccount, isSupabaseConfigured, signOut, subscribeToAccountChanges } from '../../shared-data/supabase.js';
import { buildMockAppLink, isMockContractor, mockUserFromSearch } from '../../shared-data/mockSession.js';
import { buildMockDataLink, loadMockAccountData } from '../../shared-data/mockDataSession.js';
import { buildAnalyticsInsights, buildAnalyticsSummary, buildSchedulingLink, changePresentation, toIsoDate } from './analyticsSummary.js';
import SignInPage from './SignInPage.jsx';
import { APP_URLS } from '../../shared-data/appConfig.js';
import { formatReportingDate, reportingDateFromAccount, toggleReportingDateInCurrentUrl, withReportingDate } from '../../shared-data/reportingDate.js';
import Icon, { categoryStyle } from './icons.jsx';

const STATUS_ICON = { scheduled: 'calendar', in_progress: 'trend', completed: 'check', cancelled: 'pulse' };
const STATUS_TINT_STYLE = {
  scheduled: { background: '#e5ebea', color: '#29544f' },
  in_progress: { background: '#f7efd9', color: '#7c5d24' },
  completed: { background: '#e7ebe2', color: '#424b37' },
  cancelled: { background: '#f7ecec', color: '#713e43' },
};
const CHANGE_TONE_TINT = { positive: 'tint-sage', negative: 'tint-rose', neutral: 'tint-neutral' };

const [demoAccounts, demoClients, demoJobs, demoActivity] = __FIELDFLOW_DEMO__
  ? await Promise.all([
      import('../../shared-data/accounts.json').then((module) => module.default),
      import('../../shared-data/clients.json').then((module) => module.default),
      import('../../shared-data/jobs.json').then((module) => module.default),
      import('../../shared-data/job-activity.json').then((module) => module.default),
    ])
  : [[], [], [], []];

const DEMO_ACCOUNT_ID = 'acct_northstar';
const SCHEDULING_URL = APP_URLS.scheduling;
const OPERATIONS_URL = APP_URLS.operations;
const INSIGHT_OPTIONS = [
  { id: 'status', label: 'Job status and completion' },
  { id: 'upcoming', label: 'Upcoming work' },
  { id: 'workload', label: 'Technician workload' },
  { id: 'clients', label: 'Client activity and top clients' },
  { id: 'performance', label: 'Revenue and service performance' },
  { id: 'recent', label: 'Recent activity' },
];

function formatJobDate(isoDate) {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  });
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

function defaultCustomRange(referenceDate) {
  const end = new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), referenceDate.getUTCDate()));
  const start = new Date(end.getTime() - 6 * 24 * 60 * 60 * 1000);
  return { start: toIsoDate(start), end: toIsoDate(end) };
}

export default function AnalyticsPage() {
  const [timeframe, setTimeframe] = useState('this_week');
  const [customRange, setCustomRange] = useState({ start: '', end: '' });
  const [inactiveDays, setInactiveDays] = useState(30);
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [visibleInsights, setVisibleInsights] = useState(() => new Set(INSIGHT_OPTIONS.map((option) => option.id)));
  const [sessionState, setSessionState] = useState({ loading: isSupabaseConfigured, account: null, clients: [], jobs: [], activities: [], user: null, isOps: false, error: '' });
  const [serverSummary, setServerSummary] = useState(null);

  const loadLiveData = async () => {
    setSessionState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const context = await getSignedInAccount();
      if (!context?.user) {
        setSessionState({ loading: false, account: null, clients: [], jobs: [], activities: [], user: null, isOps: false, error: '' });
        return;
      }
      if (!context.account) {
        const operations = await getOperationsSession();
        const requested = new URLSearchParams(window.location.search).get('account_id');
        if (operations?.staff && requested) {
          const operationsAccount = await getAccountById(requested);
          if (!operationsAccount) throw new Error('The requested company could not be found.');
          const [operationsJobs, operationsClients, operationsActivities] = await Promise.all([getJobsForAccount(operationsAccount.id), getClientsForAccount(operationsAccount.id), getJobActivityForAccount(operationsAccount.id)]);
          setSessionState({ loading: false, account: operationsAccount, clients: operationsClients, jobs: operationsJobs, activities: operationsActivities, user: context.user, isOps: true, error: '' });
          return;
        }
        setSessionState({ loading: false, account: null, clients: [], jobs: [], activities: [], user: context.user, isOps: false, error: 'This login is not assigned to a FieldFlow company yet.' });
        return;
      }
      const [liveJobs, liveClients, liveActivities] = await Promise.all([getJobsForAccount(context.account.id), getClientsForAccount(context.account.id), getJobActivityForAccount(context.account.id)]);
      setSessionState({ loading: false, account: context.account, clients: liveClients, jobs: liveJobs, activities: liveActivities, user: context.user, isOps: false, error: '' });
    } catch (error) {
      const message = String(error?.message ?? '').toLowerCase();
      const friendly = message.includes('jwt') || message.includes('session') || message.includes('401')
        ? 'Your session expired. Please sign in again.'
        : message.includes('permission') || message.includes('row-level')
        ? 'You don’t have access to this company’s data.'
        : typeof navigator !== 'undefined' && !navigator.onLine
        ? 'You appear to be offline. Check your connection and try again.'
        : 'We couldn’t load your data. Check your connection and try again.';
      setSessionState({ loading: false, account: null, clients: [], jobs: [], activities: [], user: null, isOps: false, error: friendly });
    }
  };

  useEffect(() => {
    if (isSupabaseConfigured) loadLiveData();
  }, []);
  useEffect(() => {
    if (!isSupabaseConfigured || !sessionState.account?.id) return undefined;
    let timer;
    const unsubscribe = subscribeToAccountChanges(sessionState.account.id, () => { clearTimeout(timer); timer = setTimeout(loadLiveData, 400); });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [sessionState.account?.id]);
  const liveReporting = reportingDateFromAccount(sessionState.account, window.location.search);
  const liveSummaryPeriod = sessionState.account
    ? buildAnalyticsSummary([], sessionState.account.id, timeframe, liveReporting.date, customRange)
    : null;
  const liveSummaryStart = liveSummaryPeriod ? toIsoDate(liveSummaryPeriod.selectedPeriod.start) : '';
  const liveSummaryEnd = liveSummaryPeriod ? toIsoDate(liveSummaryPeriod.selectedEnd) : '';
  useEffect(() => {
    if (!isSupabaseConfigured || !sessionState.account?.id || !liveSummaryStart || !liveSummaryEnd) return undefined;
    let active = true;
    setServerSummary(null);
    getAnalyticsSummary(sessionState.account.id, liveSummaryStart, liveSummaryEnd)
      .then((result) => { if (active) setServerSummary(result); })
      .catch(() => { if (active) setServerSummary(null); });
    return () => { active = false; };
  }, [sessionState.account?.id, liveSummaryStart, liveSummaryEnd]);

  const mockUser = mockUserFromSearch(window.location.search);
  const requestedAccountId = new URLSearchParams(window.location.search).get('account_id');
  const isDemoOps = !isSupabaseConfigured && mockUser?.role === 'ops';
  const isOperationsView = isDemoOps || sessionState.isOps;

  if (isSupabaseConfigured && sessionState.loading) return <main className="analytics-page"><p className="subtitle">Loading your FieldFlow account…</p></main>;
  if (isSupabaseConfigured && !sessionState.user) return <SignInPage onSignedIn={loadLiveData} />;
  if (isSupabaseConfigured && sessionState.error) return <main className="analytics-page"><p className="eyebrow">FieldFlow</p><h1>{sessionState.error.includes('not assigned') ? 'Account setup needed' : 'Analytics is unavailable'}</h1><p className="subtitle">{sessionState.error}</p><button className="action-link" type="button" onClick={loadLiveData}>Try again</button></main>;
  if (!isSupabaseConfigured && (!mockUser || (!isDemoOps && !isMockContractor(mockUser)))) return <main className="analytics-page"><p className="eyebrow">FieldFlow demo</p><h1>Start in Scheduling</h1><p className="subtitle">Sign in through Scheduling first so FieldFlow can show the right company data.</p><p className="scheduler-action"><a className="action-link" href={SCHEDULING_URL}>Open Scheduling</a></p></main>;

  const demoAccountId = isSupabaseConfigured
    ? null
    : isDemoOps
      ? (demoAccounts.some((item) => item.id === requestedAccountId) ? requestedAccountId : DEMO_ACCOUNT_ID)
      : mockUser.account_id;
  const account = isSupabaseConfigured ? sessionState.account : demoAccounts.find((item) => item.id === demoAccountId) ?? { id: demoAccountId, name: mockUser.company_name ?? 'Your new business', plan: 'Starter' };
  const mockAccountData = isSupabaseConfigured ? null : loadMockAccountData(demoAccountId, { clients: demoClients, jobs: demoJobs });
  const accountJobs = isSupabaseConfigured ? sessionState.jobs : mockAccountData.jobs;
  const accountClients = isSupabaseConfigured ? sessionState.clients : mockAccountData.clients;
  const accountActivities = isSupabaseConfigured ? sessionState.activities : demoActivity;
  const accountId = account?.id ?? (isSupabaseConfigured ? DEMO_ACCOUNT_ID : demoAccountId);
  const reporting = isSupabaseConfigured
    ? reportingDateFromAccount(account, window.location.search)
    : reportingDateFromAccount({ demo_reporting_date: '2026-08-19' }, window.location.search);
  const referenceDate = reporting.date;
  const customRangeDays = customRange.start && customRange.end
    ? Math.round((new Date(`${customRange.end}T00:00:00Z`) - new Date(`${customRange.start}T00:00:00Z`)) / (24 * 60 * 60 * 1000)) + 1
    : null;
  const customRangeError = timeframe !== 'custom_range'
    ? ''
    : !customRange.start || !customRange.end
      ? 'Choose a start and end date.'
      : customRange.end < customRange.start
        ? 'The end date must be on or after the start date.'
        : customRangeDays > 90
          ? 'Choose a range of 90 days or fewer.'
          : '';
  const summary = buildAnalyticsSummary(accountJobs, accountId, timeframe, referenceDate, customRange);
  const { selectedPeriod, selectedEnd, selectedRangeLabel, comparisonRangeLabel, selectedJobs, comparisonJobs, change, hasCompleteComparison, newClients, repeatClients, trend } = summary;
  const selectedJobsCount = serverSummary?.selected_jobs ?? selectedJobs.length;
  const comparisonJobsCount = serverSummary?.previous_jobs ?? comparisonJobs.length;
  const summaryChange = serverSummary?.change_percent ?? change;
  const newClientsCount = serverSummary?.new_clients ?? newClients;
  const repeatClientsCount = serverSummary?.repeat_clients ?? repeatClients;
  const changeStatus = changePresentation({
    selectedJobs: selectedJobsCount,
    comparisonJobs: comparisonJobsCount,
    change: summaryChange,
    hasCompleteComparison,
    comparisonRangeLabel,
  });
  const totalClients = newClientsCount + repeatClientsCount;
  const insights = buildAnalyticsInsights({ jobs: accountJobs, clients: accountClients, activities: accountActivities, accountId, summary, referenceDate, inactiveDays });
  const isInsightVisible = (insightId) => visibleInsights.has(insightId);
  const toggleInsight = (insightId) => setVisibleInsights((current) => {
    const next = new Set(current);
    if (next.has(insightId)) next.delete(insightId);
    else next.add(insightId);
    return next;
  });
  const newClientShare = totalClients === 0 ? 0 : (newClientsCount / totalClients) * 100;
  const newClientPercent = Math.round(newClientShare);
  const repeatClientPercent = totalClients === 0 ? 0 : 100 - newClientPercent;
  const schedulingLinkUrl = new URL(buildSchedulingLink(SCHEDULING_URL, accountId, selectedPeriod.start, selectedEnd));
  if (!isSupabaseConfigured && !isDemoOps) {
    const mockSchedulingLink = new URL(buildMockAppLink(schedulingLinkUrl.toString(), mockUser));
    schedulingLinkUrl.search = mockSchedulingLink.search;
  }
  const schedulingLinkBase = withReportingDate(schedulingLinkUrl.toString(), reporting);
  const schedulingLink = !isSupabaseConfigured && !isDemoOps ? buildMockDataLink(schedulingLinkBase) : schedulingLinkBase;
  const operationsReturnBase = `${OPERATIONS_URL}${isDemoOps ? '?demo_user=ops' : ''}&account_id=${encodeURIComponent(accountId)}`.replace('?&', '?');
  const returnLink = isOperationsView ? withReportingDate(operationsReturnBase, reporting) : schedulingLink;
  const returnLabel = isOperationsView ? 'Back to Operations' : 'Back to Scheduling';
  const maxJobs = Math.max(...trend.map((week) => week.jobs), 1);
  const chartWidth = 560;
  const chartHeight = 280;
  const chartLeft = 52;
  const chartRight = 20;
  const chartTop = 30;
  const chartBottom = 62;
  const plotWidth = chartWidth - chartLeft - chartRight;
  const plotHeight = chartHeight - chartTop - chartBottom;
  const pointFor = (week, index) => ({
    x: trend.length === 1 ? chartLeft + plotWidth / 2 : chartLeft + (plotWidth / (trend.length - 1)) * index,
    y: chartTop + plotHeight - (week.jobs / maxJobs) * plotHeight,
  });
  const chartPoints = trend.map(pointFor);
  const linePath = chartPoints.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const activePoint = hoveredPoint === null ? null : chartPoints[hoveredPoint];
  const activeTrend = hoveredPoint === null ? null : trend[hoveredPoint];
  const tooltipWidth = 148;
  const tooltipHeight = 48;
  const tooltipX = activePoint ? Math.min(Math.max(activePoint.x - tooltipWidth / 2, chartLeft), chartWidth - chartRight - tooltipWidth) : 0;
  const tooltipY = activePoint ? (activePoint.y < chartTop + tooltipHeight + 10 ? activePoint.y + 14 : activePoint.y - tooltipHeight - 14) : 0;

  return (
    <main className="analytics-page">
      <header className="page-header">
        <p className="eyebrow">FieldFlow</p>
        <h1>{account?.name ?? 'Your business'} — Analytics</h1>
        <div className="header-row">
          <p className="subtitle">{isOperationsView ? 'Read-only Operations view. ' : ''}A quick look at how your business is doing.{!isSupabaseConfigured && !isDemoOps ? ' Demo edits stay in this browser tab until sign-out.' : ''}</p>
          <label className="timeframe-control"><span className="timeframe-control-label"><Icon name="calendar" />Timeframe</span>
            <select title="Updates every card and chart to the selected date range." value={timeframe} onChange={(event) => {
              const nextTimeframe = event.target.value;
              setTimeframe(nextTimeframe);
              if (nextTimeframe === 'custom_range' && (!customRange.start || !customRange.end)) setCustomRange(defaultCustomRange(referenceDate));
            }}>
              <option value="this_week">This week</option>
              <option value="last_week">Last week</option>
              <option value="last_two_weeks">Last 2 weeks</option>
              <option value="last_three_weeks">Last 3 weeks</option>
              <option value="last_four_weeks">Last 4 weeks</option>
              <option value="custom_range">Custom date range</option>
            </select>
          </label>
        </div>
        {timeframe === 'custom_range' && <div className="custom-range" aria-label="Custom reporting date range">
          <label>Start date<input type="date" value={customRange.start} onChange={(event) => setCustomRange((current) => ({ ...current, start: event.target.value }))} /></label>
          <label>End date<input type="date" value={customRange.end} onChange={(event) => setCustomRange((current) => ({ ...current, end: event.target.value }))} /></label>
          <p>{customRangeError || 'Every card and chart will use this exact range and compare it with the preceding matching period.'}</p>
        </div>}
        {isSupabaseConfigured && <button className="sign-out-button" type="button" onClick={async () => { await signOut(); await loadLiveData(); }}>Sign out</button>}
      </header>

      {reporting.storedDate && <p className="demo-notice" role="status">
        {reporting.isDemoDate ? `Demo data — reporting as of ${formatReportingDate(reporting.isoDate)}.` : `Live-date preview — reporting as of ${formatReportingDate(reporting.isoDate)}.`}
        {' '}<button type="button" className="date-mode-button" onClick={() => toggleReportingDateInCurrentUrl(reporting)}>{reporting.isDemoDate ? 'Use today' : 'Return to demo date'}</button>
      </p>}

      <div className="scheduler-action">
        <a className="action-link back-link" href={returnLink} title={isDemoOps ? 'Returns to this account in Operations.' : 'Opens Scheduling with this account and selected date range.'}><Icon name="arrowLeft" />{returnLabel}</a>
      </div>

      <section className="summary-grid" aria-label="Weekly job summary">
        <article className="card primary-card" title={`Counts every job scheduled from ${selectedRangeLabel}.`}>
          <p className="card-label">{selectedRangeLabel}</p>
          <div className="stat-metric"><span className="icon-badge tint-navy"><Icon name="calendar" /></span><p className="metric">{selectedJobsCount}</p></div>
          <p className="helper">Selected period</p>
        </article>
        <article className="card" title={`Counts every job scheduled from ${comparisonRangeLabel}.`}>
          <p className="card-label">{comparisonRangeLabel}</p>
          <div className="stat-metric"><span className="icon-badge tint-neutral"><Icon name="calendar" /></span><p className="metric">{comparisonJobsCount}</p></div>
          <p className="helper">Matching previous period</p>
        </article>
        <article className="card" title={`Calculated from ${selectedJobsCount} jobs in the selected period and ${comparisonJobsCount} jobs in the previous period.`}>
          <p className="card-label">Change vs. previous period</p>
          <div className="stat-metric"><span className={`icon-badge ${CHANGE_TONE_TINT[changeStatus.tone] ?? 'tint-neutral'}`}><Icon name="trend" /></span><p className={`metric metric-status ${changeStatus.tone}`}>{changeStatus.value}</p></div>
          <p className="helper">{changeStatus.detail}</p>
        </article>
      </section>
      {selectedJobsCount === 0 && <p className="empty-state">No jobs are scheduled in this period yet. <a href={schedulingLink}>View Scheduling to create or review a job.</a></p>}

      <details className="insight-picker">
        <summary>Customize dashboard</summary>
        <p>Choose the extra details you want to see. The weekly summary and trend always stay visible.</p>
        <div className="insight-picker-options">
          {INSIGHT_OPTIONS.map((option) => <label key={option.id}>
            <input type="checkbox" checked={isInsightVisible(option.id)} onChange={() => toggleInsight(option.id)} />
            {option.label}
          </label>)}
        </div>
      </details>

      {isInsightVisible('status') && <section className="insights-grid" aria-label="Job status insights">
        <article className="card insight-card">
          <div className="card-head"><span className="icon-badge sm tint-neutral"><Icon name="chart" /></span><div><p className="eyebrow">Job status</p><h2>Work in this period</h2></div></div>
          <div className="status-list">
            {insights.statusBreakdown.map((item) => <div className="status-row" key={item.status}>
              <span className="icon-badge sm" style={STATUS_TINT_STYLE[item.status]}><Icon name={STATUS_ICON[item.status] ?? 'chart'} /></span>
              <span className="status-label">{item.label}</span>
              <span className="status-track" aria-hidden="true"><span className={`status-fill ${item.status}`} style={{ width: `${selectedJobs.length ? (item.jobs / selectedJobs.length) * 100 : 0}%` }} /></span>
              <strong>{item.jobs}</strong>
            </div>)}
          </div>
        </article>
        <article className="card insight-card completion-card">
          <div className="card-head"><span className="icon-badge sm tint-sage"><Icon name="check" /></span><p className="eyebrow">Completion</p></div>
          <h2>{insights.completionRate === null ? 'No jobs to complete' : `${insights.completionRate}% complete`}</h2>
          <p className="helper">{insights.completionRate === null ? 'Choose a period with scheduled work to see a completion rate.' : `${insights.statusBreakdown.find((item) => item.status === 'completed').jobs} completed out of ${selectedJobs.length} jobs.`}</p>
          <div className="busiest-day">
            <span>Busiest {selectedPeriod.granularity === 'day' ? 'day' : 'week'}</span>
            <strong>{insights.busiestPoint ? `${insights.busiestPoint.detail} · ${insights.busiestPoint.jobs} jobs` : 'No scheduled work'}</strong>
          </div>
        </article>
      </section>}

      {isInsightVisible('upcoming') && <section className="card insight-card list-card" aria-labelledby="upcoming-heading">
        <div className="card-head"><span className="icon-badge sm tint-terracotta"><Icon name="calendar" /></span><div><p className="eyebrow">Upcoming work</p><h2 id="upcoming-heading">Next scheduled jobs</h2></div></div>
        {insights.upcomingJobs.length ? <ul className="insight-list">
          {insights.upcomingJobs.map((job) => <li key={job.id}><div><strong>{job.clientName}</strong><span>{job.assigneeLabel}</span></div><span className={`status-pill ${job.status}`}>{job.status === 'in_progress' ? 'In progress' : 'Scheduled'}</span><time dateTime={job.scheduled_for}>{formatJobDate(job.scheduled_for)}</time></li>)}
        </ul> : <p className="helper">There is no upcoming scheduled work yet.</p>}
      </section>}

      {isInsightVisible('workload') && <section className="insights-grid" aria-label="Technician and client insights">
        <article className="card insight-card">
          <div className="card-head"><span className="icon-badge sm tint-rose"><Icon name="users" /></span><div><p className="eyebrow">Technician workload</p><h2>Jobs by assignee</h2></div></div>
          {insights.workload.length ? <ul className="ranked-list">{insights.workload.map((item) => <li key={item.assignee}><span>{item.assignee}</span><strong>{item.jobs}</strong></li>)}</ul> : <p className="helper">No jobs are assigned in this period.</p>}
        </article>
        <article className="card insight-card">
          <div className="card-head"><span className="icon-badge sm tint-ochre"><Icon name="building" /></span><div><p className="eyebrow">Top clients</p><h2>Most jobs this period</h2></div></div>
          {insights.topClients.length ? <ul className="ranked-list">{insights.topClients.map((item) => <li key={item.clientId}><span>{item.name}</span><strong>{item.jobs}</strong></li>)}</ul> : <p className="helper">No client work in this period yet.</p>}
        </article>
      </section>}

      {isInsightVisible('clients') && <section className="card client-card" aria-labelledby="client-heading">
        <div>
          <div className="card-head"><span className="icon-badge sm tint-terracotta"><Icon name="users" /></span><div><p className="eyebrow">Client mix</p><h2 id="client-heading">Who this period’s work came from</h2></div></div>
          <label className="inactive-control">Inactive after<select value={inactiveDays} onChange={(event) => setInactiveDays(Number(event.target.value))}><option value="30">30 days</option><option value="60">60 days</option><option value="90">90 days</option></select></label>
        </div>
        <div className="client-mix">
          <div
            className="donut"
            role="img"
            aria-label={`${newClientsCount} new clients and ${repeatClientsCount} repeat clients for ${selectedPeriod.label.toLowerCase()}`}
            title={`${newClientsCount} new clients (${newClientPercent}%) and ${repeatClientsCount} repeat clients (${repeatClientPercent}%).`}
            style={{ '--new-client-share': `${newClientShare}%` }}
          >
            <span>{totalClients}</span>
            <small>clients</small>
          </div>
          <div className="donut-legend">
            <p title={`${newClientsCount} of ${totalClients} clients (${newClientPercent}%) had no job before this selected period.`}><i className="legend-dot new" aria-hidden="true" />New clients <strong>{newClientsCount}</strong></p>
            <p title={`${repeatClientsCount} of ${totalClients} clients (${repeatClientPercent}%) had a job before this selected period.`}><i className="legend-dot repeat" aria-hidden="true" />Repeat clients <strong>{repeatClientsCount}</strong></p>
            <p title={`Clients with prior jobs but no work in ${selectedRangeLabel}.`}><i className="legend-dot inactive" aria-hidden="true" />Inactive clients <strong>{insights.inactiveClients.length}</strong></p>
          </div>
        </div>
      </section>
      }

      {isInsightVisible('performance') && <section className="insights-grid" aria-label="Revenue and service performance">
        <article className="card insight-card">
          <div className="card-head"><span className="icon-badge sm tint-neutral"><Icon name="receipt" /></span><p className="eyebrow">Completed-work invoice value</p></div>
          <h2>{insights.performance.invoicedJobs ? formatCurrency(insights.performance.invoiceTotal) : 'No invoice values yet'}</h2>
          <p className="helper">{insights.performance.invoicedJobs ? `${insights.performance.invoicedJobs} completed job${insights.performance.invoicedJobs === 1 ? '' : 's'} with recorded invoice values. Average: ${formatCurrency(insights.performance.averageInvoice)}.` : 'Add invoice totals to completed jobs to see this measure.'}</p>
          <div className="performance-stats">
            <span><strong>{insights.performance.averageActualMinutes === null ? '—' : `${insights.performance.averageActualMinutes} min`}</strong>Average actual duration</span>
            <span><strong>{insights.performance.averageRating === null ? '—' : `${insights.performance.averageRating} / 5`}</strong>Average client rating</span>
          </div>
        </article>
        <article className="card insight-card">
          <div className="card-head"><span className="icon-badge sm tint-sage"><Icon name="trend" /></span><div><p className="eyebrow">Completed-work value</p><h2>Invoice trend</h2></div></div>
          <div className="revenue-bars" role="img" aria-label="Completed-work invoice value over the selected period">
            {insights.performance.revenueTrend.map((point) => <div key={point.detail} title={`${point.detail}: ${formatCurrency(point.value)}`}><strong>{point.value ? formatCurrency(point.value) : '—'}</strong><i style={{ height: `${Math.max(4, (point.value / Math.max(...insights.performance.revenueTrend.map((item) => item.value), 1)) * 100)}%` }} /><small>{point.label}</small></div>)}
          </div>
        </article>
      </section>}

      {isInsightVisible('performance') && <section className="card insight-card list-card" aria-label="Service categories">
          <div className="card-head"><span className="icon-badge sm tint-rose"><Icon name="wrench" /></span><div><p className="eyebrow">Service categories</p><h2>Work by category</h2></div></div>
          {insights.performance.categoryPerformance.length ? <ul className="category-list">{insights.performance.categoryPerformance.map((item) => <li key={item.category}><span className={`icon-badge sm ${categoryStyle(item.category).tint}`}><Icon name={categoryStyle(item.category).icon} /></span><div><span>{item.category}</span><small>{item.jobs} job{item.jobs === 1 ? '' : 's'}</small></div><strong>{item.invoiceTotal ? formatCurrency(item.invoiceTotal) : '—'}</strong></li>)}</ul> : <p className="helper">No service categories are recorded for this period.</p>}
      </section>}

      {isInsightVisible('recent') && <section className="card insight-card list-card" aria-labelledby="recent-heading">
        <div className="card-head"><span className="icon-badge sm tint-neutral"><Icon name="pulse" /></span><div><p className="eyebrow">Recent activity</p><h2 id="recent-heading">Latest job updates</h2></div></div>
        {insights.recentActivity.length ? <ul className="insight-list">
          {insights.recentActivity.map((activity) => <li key={activity.id}><div><strong>{activity.clientName}</strong><span>{activity.detail}</span></div><time dateTime={activity.occurred_at}>{new Date(activity.occurred_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}</time></li>)}
        </ul> : <p className="helper">No recorded job activity yet.</p>}
      </section>}

      <section className="card trend-card" aria-labelledby="trend-heading">
        <div className="card-head"><span className="icon-badge sm tint-terracotta"><Icon name="trend" /></span><div>
          <p className="eyebrow">{selectedPeriod.granularity === 'day' ? 'Daily jobs trend' : 'Weekly jobs trend'}</p>
          <h2 id="trend-heading">{selectedPeriod.label}</h2>
        </div></div>
        <svg className="line-chart" viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-labelledby="line-chart-title line-chart-description">
          <title id="line-chart-title">Weekly jobs trend</title>
          <desc id="line-chart-description">The number of scheduled jobs for each {selectedPeriod.granularity} in {selectedPeriod.label.toLowerCase()}.</desc>
          {[0, maxJobs / 2, maxJobs].map((value) => {
            const y = chartTop + plotHeight - (value / maxJobs) * plotHeight;
            return <g key={value}><line className="grid-line" x1={chartLeft} x2={chartWidth - chartRight} y1={y} y2={y} /><text className="axis-label" x={chartLeft - 12} y={y + 4}>{Math.round(value)}</text></g>;
          })}
          <path className="trend-line" d={linePath} />
          {chartPoints.map((point, index) => <g key={`${trend[index].detail}-${index}`} onMouseEnter={() => setHoveredPoint(index)} onMouseLeave={() => setHoveredPoint(null)}><circle className="trend-point" cx={point.x} cy={point.y} r="5" /><circle className="trend-hit-area" cx={point.x} cy={point.y} r="16" tabIndex="0" aria-label={`${trend[index].detail}: ${trend[index].jobs} scheduled jobs`} onFocus={() => setHoveredPoint(index)} onBlur={() => setHoveredPoint(null)} /><text className="point-label" x={point.x} y={point.y - 13}>{trend[index].jobs}</text><text className="axis-label" x={point.x} y={chartHeight - 32} textAnchor="middle">{trend[index].label}</text></g>)}
          {activePoint && <g className="chart-tooltip" pointerEvents="none" transform={`translate(${tooltipX} ${tooltipY})`}><rect width={tooltipWidth} height={tooltipHeight} rx="6" /><text x="10" y="19">{activeTrend.detail}</text><text x="10" y="37" className="tooltip-value">{activeTrend.jobs} scheduled job{activeTrend.jobs === 1 ? '' : 's'}</text></g>}
          <text className="chart-axis-title" x={chartLeft + plotWidth / 2} y={chartHeight - 6} textAnchor="middle">{selectedPeriod.granularity === 'day' ? 'Day' : 'Week beginning'}</text>
          <text className="chart-axis-title" x="15" y={chartTop + plotHeight / 2} textAnchor="middle" transform={`rotate(-90 15 ${chartTop + plotHeight / 2})`}>Scheduled jobs</text>
        </svg>
      </section>
    </main>
  );
}
