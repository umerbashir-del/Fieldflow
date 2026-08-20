// The "AI model" for Chat Box: no external API or key involved — it's a
// small deterministic pipeline that (1) checks whether the question is an
// account lookup it can answer from live shared-data, (2) checks it against
// curated FAQ answers grounded in docs/*.md, then (3) falls back to a
// keyword search across the real doc text. Swapping this for a hosted LLM
// later is a matter of replacing getAnswer's body — callers only see
// { text, source? }.
import { accounts, clients, jobs, formatDate, clientName } from './data.js';
import { matchFaq, searchDocs } from './knowledge-base.js';

function findClientMention(lowerQuery) {
  let partial = null;
  for (const client of clients) {
    const name = client.name.toLowerCase();
    if (lowerQuery.includes(name)) return client;
    const firstWord = name.split(' ')[0];
    if (!partial && firstWord.length > 3 && new RegExp(`\\b${firstWord}\\b`).test(lowerQuery)) {
      partial = client;
    }
  }
  return partial;
}

export function getAnswer(rawQuery, accountId) {
  const query = rawQuery.trim();
  const account = accounts.find((a) => a.id === accountId);
  if (!query) {
    return { text: 'Ask me something like “How do I create a job?” or “What’s my plan?”' };
  }
  const lower = query.toLowerCase();

  const jobIdMatch = lower.match(/\bjob_\d+\b/);
  if (jobIdMatch) {
    const job = jobs.find((j) => j.id === jobIdMatch[0]);
    if (!job) return { text: `I can't find a job with id ${jobIdMatch[0]}.` };
    if (job.account_id !== accountId) {
      return { text: `${jobIdMatch[0]} isn't part of ${account.name}'s account, so I can't show it here — FieldFlow keeps every account's jobs separate.` };
    }
    return { text: `${job.title} for ${clientName(job.client_id, clients)} is ${job.status.replace('_', ' ')}, scheduled for ${formatDate(job.scheduled_for)} with ${job.assignee}.` };
  }

  if (/\bplan\b|\bsubscription\b|which account|what account|my account\b/.test(lower)) {
    return { text: `You're on the ${account.name} account, ${account.plan} plan.` };
  }

  if (/how many client|client count|number of client/.test(lower)) {
    const count = clients.filter((c) => c.account_id === accountId).length;
    return { text: `${account.name} has ${count} client${count === 1 ? '' : 's'}.` };
  }

  const client = findClientMention(lower);
  if (client) {
    if (client.account_id !== accountId) {
      return { text: `${client.name} isn't part of ${account.name}'s account, so I can't share their details here.` };
    }
    const clientJobs = jobs.filter((j) => j.client_id === client.id);
    const open = clientJobs.filter((j) => j.status !== 'completed' && j.status !== 'cancelled');
    return { text: `${client.name} is in ${client.city}. They have ${clientJobs.length} job${clientJobs.length === 1 ? '' : 's'} on file, ${open.length} still open.` };
  }

  if (/\btoday\b|\bupcoming\b|this week|next job|my schedule/.test(lower)) {
    const upcoming = jobs
      .filter((j) => j.account_id === accountId && j.status !== 'completed' && j.status !== 'cancelled')
      .sort((a, b) => a.scheduled_for.localeCompare(b.scheduled_for))
      .slice(0, 3);
    if (!upcoming.length) return { text: `${account.name} has no upcoming jobs right now.` };
    const lines = upcoming.map((j) => `• ${j.title} for ${clientName(j.client_id, clients)} — ${formatDate(j.scheduled_for)} (${j.status.replace('_', ' ')})`);
    return { text: `Here's what's coming up for ${account.name}:\n${lines.join('\n')}` };
  }

  const faqMatch = matchFaq(lower);
  if (faqMatch) return { text: faqMatch.answer, source: faqMatch.source };

  const [docHit] = searchDocs(lower);
  if (docHit) return { text: docHit.body, source: `${docHit.docTitle} — ${docHit.heading}` };

  return { text: "I don't have documentation on that yet. Try asking how to create a job, what job statuses mean, how account scoping works, or what your plan is." };
}
