import { useEffect, useState } from 'react';
import demoAccounts from '../../shared-data/accounts.json';
import demoJobs from '../../shared-data/jobs.json';
import { getJobsForAccount, getSignedInAccount, isSupabaseConfigured, signOut } from '../../shared-data/supabase.js';
import { buildAnalyticsSummary, buildSchedulingLink, chatSummaryText } from './analyticsSummary.js';
import SignInPage from './SignInPage.jsx';

const DEMO_ACCOUNT_ID = 'acct_northstar';
const SCHEDULING_URL = 'http://127.0.0.1:5174/';
const DEMO_REFERENCE_DATE = new Date('2026-08-19T12:00:00Z');

export default function AnalyticsPage() {
  const [timeframe, setTimeframe] = useState('this_week');
  const [copyStatus, setCopyStatus] = useState('');
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [sessionState, setSessionState] = useState({ loading: isSupabaseConfigured, account: null, jobs: [], user: null, error: '' });

  const loadLiveData = async () => {
    setSessionState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const context = await getSignedInAccount();
      if (!context?.user) {
        setSessionState({ loading: false, account: null, jobs: [], user: null, error: '' });
        return;
      }
      if (!context.account) {
        setSessionState({ loading: false, account: null, jobs: [], user: context.user, error: 'This login is not assigned to a FieldFlow company yet.' });
        return;
      }
      const liveJobs = await getJobsForAccount(context.account.id);
      setSessionState({ loading: false, account: context.account, jobs: liveJobs, user: context.user, error: '' });
    } catch (error) {
      setSessionState({ loading: false, account: null, jobs: [], user: null, error: error.message || 'Unable to load your FieldFlow data.' });
    }
  };

  useEffect(() => {
    if (isSupabaseConfigured) loadLiveData();
  }, []);

  if (isSupabaseConfigured && sessionState.loading) return <main className="analytics-page"><p className="subtitle">Loading your FieldFlow account…</p></main>;
  if (isSupabaseConfigured && !sessionState.user) return <SignInPage onSignedIn={loadLiveData} />;
  if (isSupabaseConfigured && sessionState.error) return <main className="analytics-page"><p className="eyebrow">FieldFlow</p><h1>Account setup needed</h1><p className="subtitle">{sessionState.error}</p></main>;

  const account = isSupabaseConfigured ? sessionState.account : demoAccounts.find((item) => item.id === DEMO_ACCOUNT_ID);
  const accountJobs = isSupabaseConfigured ? sessionState.jobs : demoJobs;
  const accountId = account?.id ?? DEMO_ACCOUNT_ID;
  const summary = buildAnalyticsSummary(accountJobs, accountId, timeframe, DEMO_REFERENCE_DATE);
  const { selectedPeriod, selectedEnd, selectedRangeLabel, comparisonRangeLabel, selectedJobs, comparisonJobs, change, hasCompleteComparison, newClients, repeatClients, trend } = summary;
  const displayedChange = hasCompleteComparison ? change : null;
  const changeDescription = displayedChange === null ? null : `${displayedChange > 0 ? 'More' : displayedChange < 0 ? 'Fewer' : 'The same number of'} jobs than ${comparisonRangeLabel}`;
  const totalClients = newClients + repeatClients;
  const newClientShare = totalClients === 0 ? 0 : (newClients / totalClients) * 100;
  const newClientPercent = Math.round(newClientShare);
  const repeatClientPercent = totalClients === 0 ? 0 : 100 - newClientPercent;
  const schedulingLink = buildSchedulingLink(SCHEDULING_URL, accountId, selectedPeriod.start, selectedEnd);
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
          <p className="subtitle">A quick look at how your business is doing.{isSupabaseConfigured ? '' : ' Demo date: August 19, 2026.'}</p>
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

      <div className="scheduler-action">
        <a className="action-link" href={schedulingLink} title="Opens Scheduling with this account and selected date range.">Back to Scheduling</a>
      </div>

      <section className="summary-grid" aria-label="Weekly job summary">
        <article className="card primary-card" title={`Counts every job scheduled from ${selectedRangeLabel}.`}>
          <p className="card-label">{selectedRangeLabel}</p>
          <p className="metric">{selectedJobs.length}</p>
          <p className="helper">Selected period</p>
        </article>
        <article className="card" title={`Counts every job scheduled from ${comparisonRangeLabel}.`}>
          <p className="card-label">{comparisonRangeLabel}</p>
          <p className="metric">{comparisonJobs.length}</p>
          <p className="helper">Previous {selectedPeriod.weeks} week{selectedPeriod.weeks === 1 ? '' : 's'}</p>
        </article>
        <article className="card" title={displayedChange === null ? 'A fair comparison is not available yet.' : `Calculated from ${selectedJobs.length} jobs versus ${comparisonJobs.length} jobs.`}>
          <p className="card-label">Change vs. previous period</p>
          <p className={`metric ${displayedChange !== null && displayedChange < 0 ? 'negative' : 'positive'}`}>
            {displayedChange === null ? '—' : `${displayedChange > 0 ? '+' : ''}${displayedChange}%`}
          </p>
          {!hasCompleteComparison && <p className="helper">Not enough earlier data for a fair comparison.</p>}
          {hasCompleteComparison && change === null && <p className="helper">No earlier jobs to compare.</p>}
          {changeDescription && <p className="helper">{changeDescription}</p>}
        </article>
      </section>

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
