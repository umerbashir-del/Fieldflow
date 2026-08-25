import jobs from '../../shared-data/jobs.json';
import clients from '../../shared-data/clients.json';
import { clientName, formatDate } from '../../shared-data/formatters.js';

export default function App() {
  const accountJobs = jobs.filter((job) => job.account_id === 'acct_northstar');
  return <main><header><div><p className="eyebrow">Cheich Toure · Scheduling</p><h1>Field schedule</h1><p className="muted">Northstar Field Services · August 2026</p></div><button>New job</button></header>
    <section className="grid">{['scheduled', 'in_progress', 'completed'].map((status) => <div className="card" key={status}><span className="muted">{status.replace('_', ' ')}</span><div className="metric">{accountJobs.filter((job) => job.status === status).length}</div></div>)}</section>
    <section style={{ marginTop: 28 }}><h2>Upcoming work</h2>{accountJobs.filter((job) => job.status !== 'completed').map((job) => <article className="job" key={job.id}><div><strong>{job.title}</strong><div className="muted">{clientName(job.client_id, clients)} · {job.assignee || 'Unassigned'}</div></div><div><div className="badge">{job.status.replace('_', ' ')}</div><div className="muted" style={{ marginTop: 6 }}>{formatDate(job.scheduled_for)}</div></div></article>)}</section>
  </main>;
}
