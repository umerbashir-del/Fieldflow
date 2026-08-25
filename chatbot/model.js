// The "AI model" for Chat Box: no external API or key involved — it's a
// small deterministic pipeline that (1) checks whether the question is an
// account lookup it can answer from live shared-data, (2) checks it against
// curated FAQ answers grounded in docs/*.md, then (3) falls back to a
// keyword search across the real doc text. Swapping this for a hosted LLM
// later is a matter of replacing getAnswer's body — callers only see
// { text, source? }.
import { accounts, clients, jobs, formatDate, clientName } from './data.js';
import { matchFaq, searchDocs } from './knowledge-base.js';
import { buildAnalyticsSummary } from '../analytics/src/analyticsSummary.js';
import { assigneeLabel } from '../shared-data/jobPresentation.js';

const DEMO_REFERENCE_DATE = new Date('2026-08-19T12:00:00Z');

function findClientMention(lowerQuery, clientRecords = clients) {
  let partial = null;
  for (const client of clientRecords) {
    const name = client.name.toLowerCase();
    if (lowerQuery.includes(name)) return client;
    const firstWord = name.split(' ')[0];
    if (!partial && firstWord.length > 3 && new RegExp(`\\b${firstWord}\\b`).test(lowerQuery)) {
      partial = client;
    }
  }
  return partial;
}

function weekBounds(date = new Date()) {
  const today = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const mondayOffset = (today.getUTCDay() + 6) % 7;
  const start = new Date(today);
  start.setUTCDate(today.getUTCDate() - mondayOffset);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

function isWeeklyScheduleQuestion(query) {
  return /\b(?:this|the|current|coming|next)\s+week\b/.test(query)
    || /\bweek\b.*\b(?:job|jobs|schedule|work)\b/.test(query)
    || /\b(?:job|jobs|schedule|work)\b.*\bweek\b/.test(query);
}

function isBusinessSummaryQuestion(query) {
  return /how.*(?:business|doing).*week|how many jobs.*week|weekly (?:summary|total)|business.*this week/.test(query);
}

export function getAnswer(rawQuery, accountContext) {
  const query = rawQuery.trim();
  const account = typeof accountContext === 'string'
    ? accounts.find((item) => item.id === accountContext)
    : accountContext?.account ?? accountContext;
  const accountId = account?.id;
  const scopedClients = accountContext?.clients ?? clients;
  const scopedJobs = accountContext?.jobs ?? jobs;
  const referenceDate = accountContext?.referenceDate ?? DEMO_REFERENCE_DATE;
  if (!query) {
    return { text: 'Ask me something like “How do I create a job?” or “What’s my plan?”' };
  }
  if (!accountId || !account) {
    return { text: 'Sign in through Scheduling so I can safely load your company context.' };
  }
  const lower = query.toLowerCase();

  if (isBusinessSummaryQuestion(lower)) {
    const summary = buildAnalyticsSummary(scopedJobs, accountId, 'this_week', referenceDate);
    const changeText = summary.change === null ? 'There is no earlier period to compare.' : `${summary.change > 0 ? '+' : ''}${summary.change}% compared with the previous week.`;
    return { text: `${account.name} this week: ${summary.selectedJobs.length} jobs, ${summary.newClients} new clients, and ${summary.repeatClients} repeat clients. ${changeText}`, source: 'Analytics summary' };
  }

  const jobIdMatch = lower.match(/\bjob_\d+\b/);
  if (jobIdMatch) {
    const job = scopedJobs.find((j) => j.id === jobIdMatch[0]);
    if (!job) return { text: `I can't find a job with id ${jobIdMatch[0]}.` };
    if (job.account_id !== accountId) {
      return { text: `${jobIdMatch[0]} isn't part of ${account.name}'s account, so I can't show it here — FieldFlow keeps every account's jobs separate.` };
    }
    return { text: `${job.title} for ${clientName(job.client_id, scopedClients)} is ${job.status.replace('_', ' ')}, scheduled for ${formatDate(job.scheduled_for)} with ${assigneeLabel(job.assignee)}.` };
  }

  if (/\bplan\b|\bsubscription\b|which account|what account|my account\b/.test(lower)) {
    return { text: `You’re using the ${account.plan} plan for ${account.name}.` };
  }

  if (/how many client|client count|number of client/.test(lower)) {
    const count = scopedClients.filter((c) => c.account_id === accountId).length;
    return { text: `${account.name} has ${count} client${count === 1 ? '' : 's'}.` };
  }

  const client = findClientMention(lower, scopedClients);
  if (client) {
    if (client.account_id !== accountId) {
      return { text: `${client.name} isn't part of ${account.name}'s account, so I can't share their details here.` };
    }
    const clientJobs = scopedJobs.filter((j) => j.client_id === client.id);
    const open = clientJobs.filter((j) => j.status !== 'completed' && j.status !== 'cancelled');
    return { text: `${client.name} is in ${client.city}. They have ${clientJobs.length} job${clientJobs.length === 1 ? '' : 's'} on file, ${open.length} still open.` };
  }

  if (isWeeklyScheduleQuestion(lower)) {
    const { start, end } = weekBounds(referenceDate);
    const weeklyJobs = scopedJobs
      .filter((j) => j.account_id === accountId
        && j.status !== 'completed'
        && j.status !== 'cancelled'
        && j.scheduled_for >= start
        && j.scheduled_for <= end)
      .sort((a, b) => a.scheduled_for.localeCompare(b.scheduled_for));
    const weekLabel = `${formatDate(start)} through ${formatDate(end)}`;
    if (!weeklyJobs.length) return { text: `You don't have any jobs scheduled this week (${weekLabel}).` };
    return {
      text: `You have ${weeklyJobs.length} job${weeklyJobs.length === 1 ? '' : 's'} scheduled this week (${weekLabel}):`,
      jobs: weeklyJobs.map((j) => ({
        title: j.title,
        client: clientName(j.client_id, scopedClients),
        iso: j.scheduled_for,
        status: j.status,
        assignee: j.assignee,
      })),
    };
  }

  if (/\btoday\b|\bupcoming\b|next job|my schedule/.test(lower)) {
    const upcoming = scopedJobs
      .filter((j) => j.account_id === accountId && j.status !== 'completed' && j.status !== 'cancelled')
      .sort((a, b) => a.scheduled_for.localeCompare(b.scheduled_for))
      .slice(0, 3);
    if (!upcoming.length) return { text: `${account.name} has no upcoming jobs right now.` };
    return {
      text: `Here's what's coming up for ${account.name}:`,
      jobs: upcoming.map((j) => ({
        title: j.title,
        client: clientName(j.client_id, scopedClients),
        iso: j.scheduled_for,
        status: j.status,
        assignee: j.assignee,
      })),
    };
  }

  const faqMatch = matchFaq(lower);
  if (faqMatch) return { text: faqMatch.answer, source: faqMatch.source };

  const [docHit] = searchDocs(lower);
  if (docHit) {
    return {
      text: 'I can help with your schedule, jobs, clients, job status, and account questions. Try asking “What jobs do I have this week?” or “How do I add a client?”',
      source: 'FieldFlow help',
    };
  }

  return { text: NO_ANSWER_TEXT };
}

// Exported so callers (e.g. chatbot.js) can detect this exact fallback and
// decide whether to try an external API before showing it to the user.
export const NO_ANSWER_TEXT = "I don't have documentation on that yet. Try asking how to create a job, what job statuses mean, how account scoping works, or what your plan is.";
