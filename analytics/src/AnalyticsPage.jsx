import { useEffect, useState } from 'react';
import { getAccountById, getAnalyticsDashboardData, getOperationsSession, getSignedInAccount, isSupabaseConfigured, signOut } from '../../shared-data/supabase.js';
import { buildMockAppLink, isMockContractor, mockUserFromSearch } from '../../shared-data/mockSession.js';
import { buildMockDataLink, loadMockAccountData } from '../../shared-data/mockDataSession.js';
import { buildAnalyticsSummary, buildSchedulingLink, buildServerAnalyticsSummary, chatSummaryText, getAnalyticsPeriod, toIsoDate } from './analyticsSummary.js';
import SignInPage from './SignInPage.jsx';
import { APP_URLS } from '../../shared-data/appConfig.js';
import { formatReportingDate, reportingDateFromAccount, toggleReportingDateInCurrentUrl, withReportingDate } from '../../shared-data/reportingDate.js';

const [demoAccounts, demoJobs] = __FIELDFLOW_DEMO__
  ? await Promise.all([
      import('../../shared-data/accounts.json').then((module) => module.default),
      import('../../shared-data/jobs.json').then((module) => module.default),
    ])
  : [[], []];

const DEMO_ACCOUNT_ID = 'acct_northstar';
const SCHEDULING_URL = APP_URLS.scheduling;
const OPERATIONS_URL = APP_URLS.operations;
const CHATBOT_URL = APP_URLS.chatbot;

export default function AnalyticsPage() {
  const [timeframe, setTimeframe] = useState('this_week');
  const [copyStatus, setCopyStatus] = useState('');
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [sessionState, setSessionState] = useState({ loading: isSupabaseConfigured, account: null, jobs: [], user: null, isOps: false, error: '' });
  const [liveSummaryState, setLiveSummaryState] = useState({ loading: false, summary: null, error: '' });
  const [summaryRefresh, setSummaryRefresh] = useState(0);

  const loadLiveData = async () => {
    setSessionState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const context = await getSignedInAccount();
      if (!context?.user) {
        setSessionState({ loading: false, account: null, jobs: [], user: null, isOps: false, error: '' });
        return;
      }
      if (!context.account) {
        const operations = await getOperationsSession();
        const requested = new URLSearchParams(window.location.search).get('account_id');
        if (operations?.staff && requested) {
          const operationsAccount = await getAccountById(requested);
          if (!operationsAccount) throw new Error('The requested company could not be found.');
          setSessionState({ loading: false, account: operationsAccount, jobs: [], user: context.user, isOps: true, error: '' });
          return;
        }
        setSessionState({ loading: false, account: null, jobs: [], user: context.user, isOps: false, error: 'This login is not assigned to a FieldFlow company yet.' });
        return;
      }
      setSessionState({ loading: false, account: context.account, jobs: [], user: context.user, isOps: false, error: '' });
    } catch (error) {
      const message = String(error?.message ?? '').toLowerCase();
      const friendly = message.includes('jwt') || message.includes('session') || message.includes('401')
        ? 'Your session expired. Please sign in again.'
        : message.includes('permission') || message.includes('row-level')
        ? 'You don’t have access to this company’s data.'
        : typeof navigator !== 'undefined' && !navigator.onLine
        ? 'You appear to be offline. Check your connection and try again.'
        : 'We couldn’t load your data. Check your connection and try again.';
      setSessionState({ loading: false, account: null, jobs: [], user: null, isOps: false, error: friendly });
    }
  };

  useEffect(() => {
    if (isSupabaseConfigured) loadLiveData();
  }, []);

  const liveReporting = reportingDateFromAccount(sessionState.account, window.location.search);
  useEffect(() => {
    if (!isSupabaseConfigured || !sessionState.account) return undefined;
    let cancelled = false;
    const period = getAnalyticsPeriod(timeframe, liveReporting.date);
    setLiveSummaryState({ loading: true, summary: null, error: '' });
    getAnalyticsDashboardData(sessionState.account.id, toIsoDate(period.selectedPeriod.start), toIsoDate(period.selectedEnd))
      .then((data) => {
        if (cancelled) return;
        setLiveSummaryState({
          loading: false,
          summary: buildServerAnalyticsSummary({
            accountId: sessionState.account.id,
            timeframe,
            referenceDate: liveReporting.date,
            ...data,
          }),
          error: '',
        });
      })
      .catch((error) => {
        if (!cancelled) setLiveSummaryState({ loading: false, summary: null, error: error.message || 'Analytics could not be loaded.' });
      });
    return () => { cancelled = true; };
  }, [timeframe, sessionState.account?.id, liveReporting.isoDate, summaryRefresh]);

  const mockUser = mockUserFromSearch(window.location.search);
  const requestedAccountId = new URLSearchParams(window.location.search).get('account_id');
  const isDemoOps = !isSupabaseConfigured && mockUser?.role === 'ops';
  const isOperationsView = isDemoOps || sessionState.isOps;

  if (isSupabaseConfigured && sessionState.loading) return <main className="analytics-page"><p className="subtitle">Loading your FieldFlow account…</p></main>;
  if (isSupabaseConfigured && sessionState.error) return <main className="analytics-page"><p className="eyebrow">FieldFlow</p><h1>{sessionState.error.includes('not assigned') ? 'Account setup needed' : 'Analytics is unavailable'}</h1><p className="subtitle">{sessionState.error}</p><button className="action-link" type="button" onClick={loadLiveData}>Try again</button></main>;
  if (isSupabaseConfigured && !sessionState.user) return <SignInPage onSignedIn={loadLiveData} />;
  if (isSupabaseConfigured && sessionState.account && (liveSummaryState.loading || !liveSummaryState.summary) && !liveSummaryState.error) return <main className="analytics-page"><p className="subtitle">Calculating your selected period…</p></main>;
  if (isSupabaseConfigured && liveSummaryState.error) return <main className="analytics-page"><p className="eyebrow">FieldFlow</p><h1>Analytics is unavailable</h1><p className="subtitle">{liveSummaryState.error}</p><button className="action-link" type="button" onClick={() => setSummaryRefresh((current) => current + 1)}>Try again</button></main>;
  if (!isSupabaseConfigured && (!mockUser || (!isDemoOps && !isMockContractor(mockUser)))) return <main className="analytics-page"><p className="eyebrow">FieldFlow demo</p><h1>Start in Scheduling</h1><p className="subtitle">Sign in through Scheduling first so FieldFlow can show the right company data.</p><p className="scheduler-action"><a className="action-link" href={SCHEDULING_URL}>Open Scheduling</a></p></main>;

  const demoAccountId = isSupabaseConfigured
    ? null
    : isDemoOps
      ? (demoAccounts.some((item) => item.id === requestedAccountId) ? requestedAccountId : DEMO_ACCOUNT_ID)
      : mockUser.account_id;
  const account = isSupabaseConfigured ? sessionState.account : demoAccounts.find((item) => item.id === demoAccountId) ?? { id: demoAccountId, name: mockUser.company_name ?? 'Your new business', plan: 'Starter' };
  const accountJobs = isSupabaseConfigured ? [] : loadMockAccountData(demoAccountId, { clients: [], jobs: demoJobs }).jobs;
  const accountId = account?.id ?? (isSupabaseConfigured ? DEMO_ACCOUNT_ID : demoAccountId);
  const reporting = isSupabaseConfigured
    ? liveReporting
    : reportingDateFromAccount({ demo_reporting_date: '2026-08-19' }, window.location.search);
  const referenceDate = reporting.date;
  const summary = isSupabaseConfigured ? liveSummaryState.summary : buildAnalyticsSummary(accountJobs, accountId, timeframe, referenceDate);
  const { selectedPeriod, selectedEnd, selectedRangeLabel, comparisonRangeLabel, selectedJobCount, comparisonJobCount, change, hasCompleteComparison, newClients, repeatClients, trend } = summary;
  const displayedChange = hasCompleteComparison ? change : null;
  const changeDescription = displayedChange === null ? null : `${displayedChange > 0 ? 'More' : displayedChange < 0 ? 'Fewer' : 'The same number of'} jobs than ${comparisonRangeLabel}`;
  const totalClients = newClients + repeatClients;
  const newClientShare = totalClients === 0 ? 0 : (newClients / totalClients) * 100;
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
  const chatLink = isOperationsView ? null : withReportingDate(!isSupabaseConfigured ? buildMockDataLink(buildMockAppLink(CHATBOT_URL, mockUser)) : CHATBOT_URL, reporting);
  const copyChatSummary = async () => {
    await navigator.clipboard.writeText(chatSummaryText(account?.name ?? 'Your business', summary));
    setCopyStatus('Copied — paste this into FieldFlow Chat.');
  };
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
          <label className="timeframe-control">Timeframe
            <select title="Updates every card and chart to the selected date range." value={timeframe} onChange={(event) => setTimeframe(event.target.value)}>
              <option value="this_week">This week</option>
              <option value="last_week">Last week</option>
              <option value="last_two_weeks">Last 2 weeks</option>
              <option value="last_three_weeks">Last 3 weeks</option>
              <option value="last_four_weeks">Last 4 weeks</option>
            </select>
          </label>
        </div>
        {isSupabaseConfigured && <button className="sign-out-button" type="button" onClick={async () => { await signOut(); await loadLiveData(); }}>Sign out</button>}
      </header>

      {reporting.storedDate && <p className="demo-notice" role="status">
        {reporting.isDemoDate ? `Demo data — reporting as of ${formatReportingDate(reporting.isoDate)}.` : `Live-date preview — reporting as of ${formatReportingDate(reporting.isoDate)}.`}
        {' '}<button type="button" className="date-mode-button" onClick={() => toggleReportingDateInCurrentUrl(reporting)}>{reporting.isDemoDate ? 'Use today' : 'Return to demo date'}</button>
      </p>}

      <div className="scheduler-action">
        <a className="action-link" href={returnLink} title={isDemoOps ? 'Returns to this account in Operations.' : 'Opens Scheduling with this account and selected date range.'}>{returnLabel}</a>
        {chatLink && <a className="action-link" href={chatLink} title="Opens Support Chat for this company.">Support Chat</a>}
      </div>

      <section className="summary-grid" aria-label="Weekly job summary">
        <article className="card primary-card" title={`Counts every job scheduled from ${selectedRangeLabel}.`}>
          <p className="card-label">{selectedRangeLabel}</p>
          <p className="metric">{selectedJobCount}</p>
          <p className="helper">Selected period</p>
        </article>
        <article className="card" title={`Counts every job scheduled from ${comparisonRangeLabel}.`}>
          <p className="card-label">{comparisonRangeLabel}</p>
          <p className="metric">{comparisonJobCount}</p>
          <p className="helper">Previous {selectedPeriod.weeks} week{selectedPeriod.weeks === 1 ? '' : 's'}</p>
        </article>
        <article className="card" title={displayedChange === null ? 'A fair comparison is not available yet.' : `Calculated from ${selectedJobCount} jobs versus ${comparisonJobCount} jobs.`}>
          <p className="card-label">Change vs. previous period</p>
          <p className={`metric ${displayedChange !== null && displayedChange < 0 ? 'negative' : 'positive'}`}>
            {displayedChange === null ? '—' : `${displayedChange > 0 ? '+' : ''}${displayedChange}%`}
          </p>
          {!hasCompleteComparison && <p className="helper">Not enough earlier data for a fair comparison.</p>}
          {hasCompleteComparison && change === null && <p className="helper">No earlier jobs to compare.</p>}
          {changeDescription && <p className="helper">{changeDescription}</p>}
        </article>
      </section>
      {selectedJobCount === 0 && <p className="empty-state">No jobs are scheduled in this period yet. Add one in Scheduling to update this view.</p>}

      <section className="card client-card" aria-labelledby="client-heading">
        <div>
          <p className="eyebrow">Client mix</p>
          <h2 id="client-heading">Who this period’s work came from</h2>
        </div>
        <div className="client-mix">
          <div
            className="donut"
            role="img"
            aria-label={`${newClients} new clients and ${repeatClients} repeat clients for ${selectedPeriod.label.toLowerCase()}`}
            title={`${newClients} new clients (${newClientPercent}%) and ${repeatClients} repeat clients (${repeatClientPercent}%).`}
            style={{ '--new-client-share': `${newClientShare}%` }}
          >
            <span>{totalClients}</span>
            <small>clients</small>
          </div>
          <div className="donut-legend">
            <p title={`${newClients} of ${totalClients} clients (${newClientPercent}%) had no job before this selected period.`}><i className="legend-dot new" aria-hidden="true" />New clients <strong>{newClients}</strong></p>
            <p title={`${repeatClients} of ${totalClients} clients (${repeatClientPercent}%) had a job before this selected period.`}><i className="legend-dot repeat" aria-hidden="true" />Repeat clients <strong>{repeatClients}</strong></p>
          </div>
        </div>
      </section>

      <section className="card trend-card" aria-labelledby="trend-heading">
        <div>
          <p className="eyebrow">{selectedPeriod.granularity === 'day' ? 'Daily jobs trend' : 'Weekly jobs trend'}</p>
          <h2 id="trend-heading">{selectedPeriod.label}</h2>
        </div>
        <svg className="line-chart" viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-labelledby="line-chart-title line-chart-description">
          <title id="line-chart-title">Weekly jobs trend</title>
          <desc id="line-chart-description">The number of scheduled jobs for each {selectedPeriod.granularity} in {selectedPeriod.label.toLowerCase()}.</desc>
          {[0, maxJobs / 2, maxJobs].map((value) => {
            const y = chartTop + plotHeight - (value / maxJobs) * plotHeight;
            return <g key={value}><line className="grid-line" x1={chartLeft} x2={chartWidth - chartRight} y1={y} y2={y} /><text className="axis-label" x={chartLeft - 12} y={y + 4}>{Math.round(value)}</text></g>;
          })}
          <path className="trend-line" d={linePath} />
          {chartPoints.map((point, index) => <g key={trend[index].label} onMouseEnter={() => setHoveredPoint(index)} onMouseLeave={() => setHoveredPoint(null)}><circle className="trend-point" cx={point.x} cy={point.y} r="5" /><circle className="trend-hit-area" cx={point.x} cy={point.y} r="16" tabIndex="0" aria-label={`${trend[index].detail}: ${trend[index].jobs} scheduled jobs`} onFocus={() => setHoveredPoint(index)} onBlur={() => setHoveredPoint(null)} /><text className="point-label" x={point.x} y={point.y - 13}>{trend[index].jobs}</text><text className="axis-label" x={point.x} y={chartHeight - 32} textAnchor="middle">{trend[index].label}</text></g>)}
          {activePoint && <g className="chart-tooltip" pointerEvents="none" transform={`translate(${tooltipX} ${tooltipY})`}><rect width={tooltipWidth} height={tooltipHeight} rx="6" /><text x="10" y="19">{activeTrend.detail}</text><text x="10" y="37" className="tooltip-value">{activeTrend.jobs} scheduled job{activeTrend.jobs === 1 ? '' : 's'}</text></g>}
          <text className="chart-axis-title" x={chartLeft + plotWidth / 2} y={chartHeight - 6} textAnchor="middle">{selectedPeriod.granularity === 'day' ? 'Day of week' : 'Week beginning'}</text>
          <text className="chart-axis-title" x="15" y={chartTop + plotHeight / 2} textAnchor="middle" transform={`rotate(-90 15 ${chartTop + plotHeight / 2})`}>Scheduled jobs</text>
        </svg>
      </section>

      <section className="integration-actions" aria-label="Connect with other FieldFlow tools">
        <div>
          <button className="copy-button" type="button" title="Copies the current Analytics summary so you can paste it into FieldFlow Chat." onClick={copyChatSummary}>Copy summary for Chat</button>
          {copyStatus && <p className="copy-status" role="status">{copyStatus}</p>}
        </div>
      </section>
    </main>
  );
}
