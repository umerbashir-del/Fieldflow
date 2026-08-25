// Regression tests for getAnswer(): each case checks that a realistic query
// resolves to the right *source* — a real shared-data record, a curated FAQ,
// a doc section, or (for unmatched queries) the static fallback — so a
// change to model.js or knowledge-base.js that quietly breaks a lookup path
// gets caught instead of shipping unnoticed.
//
// model.js pulls docs via Vite's `?raw` import, which plain Node can't
// resolve, so tests load it the same way the dev server does: through
// Vite's SSR module runner (see chatbot/vite.config.js's fs.allow comment).
import assert from 'node:assert/strict';
import { test, before, after } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const ACCOUNT_ID = 'acct_northstar'; // Northstar Field Services, Growth plan

let getAnswer;
let server;

before(async () => {
  const chatbotRoot = fileURLToPath(new URL('..', import.meta.url));
  const configFile = fileURLToPath(new URL('../vite.config.js', import.meta.url));
  server = await createServer({
    root: chatbotRoot,
    configFile,
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'error',
  });
  ({ getAnswer } = await server.ssrLoadModule('/model.js'));
});

after(async () => {
  await server?.close();
});

test('job id lookup returns the real job record', () => {
  const { text } = getAnswer('job_071', ACCOUNT_ID);
  assert.equal(text, 'Summer system inspection for Evergreen Properties is completed, scheduled for June 29, 2026 with Maya Chen.');
});

test('job id lookup reports an unknown id instead of guessing', () => {
  const { text } = getAnswer('job_999', ACCOUNT_ID);
  assert.equal(text, "I can't find a job with id job_999.");
});

test('job id lookup refuses a job that belongs to another account', () => {
  const { text } = getAnswer('job_201', ACCOUNT_ID); // job_201 is acct_horizon
  assert.match(text, /isn't part of Northstar Field Services's account/);
});

test('account/plan lookup reads the real account record', () => {
  const { text } = getAnswer('what plan am I on?', ACCOUNT_ID);
  assert.equal(text, 'You’re using the Growth plan for Northstar Field Services.');
});

test('a new empty business receives its own plan response', () => {
  const { text } = getAnswer("What's my plan?", {
    account: { id: 'acct_demo_avery', name: 'Avery Plumbing', plan: 'Starter' },
    clients: [],
    jobs: [],
  });
  assert.equal(text, 'You’re using the Starter plan for Avery Plumbing.');
});

test('a new empty business does not inherit another company’s upcoming jobs', () => {
  const { text } = getAnswer('what is on my schedule today?', {
    account: { id: 'acct_demo_avery', name: 'Avery Plumbing', plan: 'Starter' },
    clients: [],
    jobs: [],
  });
  assert.equal(text, 'Avery Plumbing has no upcoming jobs right now.');
});

test('client count reflects the real client list for this account', () => {
  const { text } = getAnswer('how many clients do we have?', ACCOUNT_ID);
  assert.equal(text, 'Northstar Field Services has 18 clients.');
});

test('client name mention pulls that client\'s real record', () => {
  const { text } = getAnswer('tell me about Cedar Point Studios', ACCOUNT_ID);
  assert.equal(text, 'Cedar Point Studios is in Cary. They have 6 jobs on file, 0 still open.');
});

test('client name mention refuses a client from another account', () => {
  const { text } = getAnswer('tell me about Arcade Market', ACCOUNT_ID); // acct_horizon client
  assert.match(text, /isn't part of Northstar Field Services's account/);
});

test('schedule query returns the real upcoming jobs, soonest first', () => {
  const { text, jobs } = getAnswer('what is on my schedule today?', ACCOUNT_ID);
  assert.equal(text, "Here's what's coming up for Northstar Field Services:");
  assert.deepEqual(jobs.map((j) => j.title), [
    'Rooftop unit diagnosis',
    'Warehouse HVAC estimate',
    'Classroom airflow check',
  ]);
});

test('FAQ match: creating a job cites Scheduling', () => {
  const { source } = getAnswer('how do I create a job?', ACCOUNT_ID);
  assert.equal(source, 'Scheduling');
});

test('FAQ match: job statuses cites Jobs', () => {
  const { source } = getAnswer('what are the possible statuses?', ACCOUNT_ID);
  assert.equal(source, 'Jobs');
});

test('FAQ match: account scoping cites Privacy', () => {
  const { text, source } = getAnswer('can other companies see my data?', ACCOUNT_ID);
  assert.match(text, /only see your own company/);
  assert.equal(source, 'Privacy');
});

test('FAQ match: date format cites Scheduling', () => {
  const { source } = getAnswer('what date format do you use?', ACCOUNT_ID);
  assert.equal(source, 'Scheduling');
});

test('FAQ match: contact support cites Support', () => {
  const { source } = getAnswer('I need to talk to support', ACCOUNT_ID);
  assert.equal(source, 'Support');
});

test('unmatched-FAQ query falls back to the generic FieldFlow help pointer', () => {
  const { source } = getAnswer('what fields make up a service address?', ACCOUNT_ID);
  assert.equal(source, 'FieldFlow help');
});

test('fully unmatched query returns the static fallback, not a guess', () => {
  const { text, source } = getAnswer('who won the game last night?', ACCOUNT_ID);
  assert.equal(text, "I don't have documentation on that yet. Try asking how to create a job, what job statuses mean, how account scoping works, or what your plan is.");
  assert.equal(source, undefined);
});
