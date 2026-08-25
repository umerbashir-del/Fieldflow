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

// The real docs are written for developers (HTTP endpoints, JSON shapes,
// snake_case field names, internal build notes), so raw excerpts are never
// shown to chat users. Each entry below is a hand-written, plain-language
// stand-in for one doc section — keyed by "docTitle — heading" — used only
// when a section matches the search below. Sections with no entry here
// (component/build notes, the relationship diagram, etc.) are excluded from
// the fallback entirely, so an unmatched query never leaks internal text.
const DOC_OVERRIDES = {
  'data-model.md — Client': "A client's service address is stored as separate parts — building number, street, city, state, and zip — plus a phone number for appointment calls. That keeps addresses consistent so scheduling can sort and look them up reliably.",
  'data-model.md — Job': 'Each job belongs to one client and has a scheduled date and a status — Scheduled, In progress, Completed, or Cancelled.',
  'standards.md — Account scope': "Every job and client only ever belongs to one account, and FieldFlow never guesses your account from your name or email — so you'll only ever see your own company's data.",
  'standards.md — Dates': 'Dates are always shown to you as Month Day, Year — for example, August 20, 2026.',
};

const sections = docs
  .flatMap(parseSections)
  .map((s) => ({ ...s, key: `${s.docTitle} — ${s.heading}` }))
  .filter((s) => DOC_OVERRIDES[s.key])
  .map((s) => ({ ...s, body: DOC_OVERRIDES[s.key] }));

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
    keywords: ['create', 'new', 'add', 'schedule', 'appointment', 'booking'],
    answer: 'Open Scheduling and click New Job. Choose the client, date, and team member, then save it. The job will appear on your schedule.',
    source: 'Scheduling',
  },
  {
    id: 'job-status',
    keywords: ['status', 'statuses', 'progress', 'complete', 'completed', 'cancel', 'cancelled', 'update'],
    answer: 'A job can be scheduled, in progress, completed, or cancelled. Open the job card to change its status whenever the work moves forward.',
    source: 'Jobs',
  },
  {
    id: 'add-client',
    keywords: ['client', 'clients', 'customer', 'customers'],
    answer: 'Open Scheduling, then go to the Clients tab. Add the customer’s name and city, and save the new client.',
    source: 'Clients',
  },
  {
    id: 'account-scope',
    keywords: ['other', 'another', 'company', 'see', 'missing', 'scope', 'scoped', 'privacy', 'private', 'leak'],
    answer: "You can only see your own company’s jobs and clients. That keeps each company’s information private.",
    source: 'Privacy',
  },
  {
    id: 'date-format',
    keywords: ['date', 'dates', 'format', 'when'],
    answer: 'Dates are shown in a simple format, like August 20, 2026, so they are easy to read.',
    source: 'Scheduling',
  },
  {
    id: 'contact-support',
    keywords: ['support', 'message', 'help', 'contact', 'human', 'agent'],
    answer: 'Send us a message here in the chat, and the support team will help you.',
    source: 'Support',
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
