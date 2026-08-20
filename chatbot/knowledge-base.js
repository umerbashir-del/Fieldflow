// Turns docs/*.md into a small searchable index, and pairs it with a
// handful of curated, contractor-facing answers for the questions people
// actually ask most. Curated answers are checked first (they read better
// than a raw doc excerpt); anything else falls back to a keyword search
// over the real doc text, so the bot can still answer from documentation
// it wasn't specifically written for.
import { docs } from './data.js';

const STOPWORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'do', 'does', 'how', 'what', 'why', 'can',
  'i', 'to', 'of', 'in', 'on', 'for', 'my', 'your', 'and', 'or', 'it',
  'this', 'that', 'with', 'be', 'me', 'about', 'you',
]);

function tokenize(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s_]/g, ' ').split(/\s+/).filter((w) => w && !STOPWORDS.has(w));
}

// Splits a doc on its "## " headings. A doc with no level-2 headings
// (api-contract.md) comes back as a single section under its own title.
function parseSections(doc) {
  const lines = doc.text.split('\n');
  const sections = [];
  let current = { heading: doc.title, body: [] };
  for (const line of lines) {
    const h2 = line.match(/^##\s+(.*)/);
    if (h2) {
      sections.push(current);
      current = { heading: h2[1].trim(), body: [] };
    } else if (/^#\s+/.test(line) || /^```/.test(line)) {
      continue; // drop the doc's H1 title line and code-fence markers
    } else {
      current.body.push(line);
    }
  }
  sections.push(current);
  return sections
    .map((s) => ({ ...s, body: s.body.join('\n').trim() }))
    .filter((s) => s.body.length > 0)
    .map((s) => ({ docTitle: doc.title, heading: s.heading, body: s.body }));
}

const sections = docs.flatMap(parseSections);

function scoreSection(queryTokens, section) {
  const headingTokens = tokenize(section.heading);
  const bodyTokens = tokenize(section.body);
  let score = 0;
  queryTokens.forEach((t) => {
    if (headingTokens.includes(t)) score += 2;
    if (bodyTokens.includes(t)) score += 1;
  });
  return score;
}

export function searchDocs(query) {
  const queryTokens = tokenize(query);
  if (!queryTokens.length) return [];
  return sections
    .map((section) => ({ section, score: scoreSection(queryTokens, section) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 1)
    .map((s) => s.section);
}

export const FAQ = [
  {
    id: 'create-job',
    keywords: ['create', 'new', 'add', 'schedule', 'job', 'appointment', 'booking'],
    answer: "Open Scheduling and click New Job — pick the client, date, and assignee. That saves through POST /accounts/:account_id/jobs, so it's automatically scoped to your account.",
    source: 'api-contract.md',
  },
  {
    id: 'job-status',
    keywords: ['status', 'statuses', 'progress', 'complete', 'completed', 'cancel', 'cancelled', 'update'],
    answer: 'FieldFlow uses four job statuses: scheduled, in_progress, completed, and cancelled. Change one from the job’s card — that calls PATCH /accounts/:account_id/jobs/:job_id.',
    source: 'standards.md — Shared behavior',
  },
  {
    id: 'add-client',
    keywords: ['client', 'clients', 'customer', 'customers'],
    answer: 'Add clients from the Clients tab in Scheduling. Keep records small — name and city; operational notes belong in the API, not copied into the product.',
    source: 'data-model.md — Client',
  },
  {
    id: 'account-scope',
    keywords: ['other', 'another', 'company', 'see', 'missing', 'scope', 'scoped', 'privacy', 'private', 'leak'],
    answer: "Every job and client is scoped to one account_id, and FieldFlow never infers your account from your name or email. So you'll only ever see your own account's data, by design.",
    source: 'standards.md — Account scope',
  },
  {
    id: 'date-format',
    keywords: ['date', 'dates', 'format', 'when'],
    answer: 'Dates are stored as ISO 8601 (YYYY-MM-DD) but always shown to you as Month Day, Year — for example, August 20, 2026.',
    source: 'standards.md — Dates',
  },
  {
    id: 'contact-support',
    keywords: ['support', 'message', 'help', 'contact', 'human', 'agent'],
    answer: 'Send a message through the chat panel — it posts to POST /accounts/:account_id/chat/messages, so support automatically sees which account you’re asking from.',
    source: 'api-contract.md',
  },
];

export function matchFaq(query) {
  const tokens = tokenize(query);
  let best = null;
  let bestScore = 0;
  for (const entry of FAQ) {
    const score = entry.keywords.reduce((acc, k) => acc + (tokens.includes(k) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }
  return best;
}
