// Focused regression tests for the delete-confirmation flow, the
// zero-clients New Job recovery path, and modal visibility on a scrolled
// page. Run with: npm test --workspace=@fieldflow/scheduling
// (needs Playwright's browser installed once: npx playwright install chromium)
//
// NOTE: since the Supabase/live-mode merge, scheduling.js is a real ES
// module (import/export, top-level await) loaded via <script type="module">
// — it can no longer be opened directly over file://, browsers block
// module script loading from file: origins. So this suite now spins up
// the actual Vite dev server itself (child_process) and drives it over
// http://localhost, the same way you'd run it by hand with `npm run dev`.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 5187; // dedicated port so this doesn't collide with a dev server you already have open on 5174
const BASE_URL = `http://localhost:${PORT}/scheduling.html`;
// A fixed demo login so every test starts already signed in, without
// having to click through the mock-login form each time.
const DEMO_QUERY = '?demo_user=john&demo_name=John&demo_email=john@fieldflow.demo&demo_company=Northstar';

let browser;
let page;
let viteProcess;

async function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 404) return;
    } catch (e) { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Dev server at ${url} did not start within ${timeoutMs}ms`);
}

before(async () => {
  viteProcess = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], {
    cwd: path.join(__dirname, '..'),
    stdio: 'ignore', // don't let an undrained pipe buffer block the dev server
  });
  await waitForServer(`http://localhost:${PORT}/`);
  browser = await chromium.launch();
});

after(async () => {
  await browser.close();
  if (viteProcess) viteProcess.kill();
});

// Fresh, already-signed-in page for every test, seeded before the app's
// own script runs — this avoids each test depending on the real
// shared-data seed (which can change) or on state left over from a
// previous test.
//
// Demo-mode persistence isn't localStorage — it's shared-data/
// mockDataSession.js, which stores clients/jobs in window.name (tab-
// scoped, so Scheduling/Analytics/Chatbot on different Vite ports can
// hand off the same edited demo data within one browser tab). So
// seeding has to write to window.name in that same shape, not
// localStorage.
async function freshPage(seed) {
  if (page) await page.close();
  page = await browser.newPage();
  if (seed) {
    await page.addInitScript((state) => {
      window.name = JSON.stringify({ fieldflowMockData: { accounts: { acct_northstar: state } } });
    }, seed);
  }
  await page.goto(BASE_URL + DEMO_QUERY);
  await page.waitForSelector('#schedulingApp:not([hidden])');
  return page;
}

const ACCOUNT_ID = 'acct_northstar';
// Matches the app's own todayISO() (date-utils.js), which uses UTC date
// parts — computed fresh so these tests don't quietly rot as "today"
// drifts forward past a hardcoded date and jobs stop showing on Home.
const TODAY_ISO = new Date().toISOString().slice(0, 10);

function makeClient(id, overrides) {
  return Object.assign({
    id, account_id: ACCOUNT_ID, name: 'Test Client ' + id,
    building_number: '', street_name: '', city: '', state: '', zip_code: '', client_phone: '',
  }, overrides);
}

function makeJob(id, clientId, overrides) {
  return Object.assign({
    id, account_id: ACCOUNT_ID, client_id: clientId, title: 'Test Job ' + id,
    scheduled_for: TODAY_ISO, status: 'scheduled', assignee: 'Maya Chen',
  }, overrides);
}

test('a job is not deleted on the first Delete click — it only arms the confirm', async () => {
  const client = makeClient('c1');
  const job = makeJob('j1', 'c1');
  const p = await freshPage({ clients: [client], jobs: [job] });

  await p.click('.job'); // open the job for edit (only one job on the page)
  assert.equal((await p.textContent('#deleteJobBtn')).trim(), 'Delete');

  await p.click('#deleteJobBtn');
  assert.equal((await p.textContent('#deleteJobBtn')).trim(), 'Click again to delete');
  assert.equal(await p.isVisible('#jobModalBackdrop'), true, 'modal should still be open');
  assert.equal(await p.locator('.job').count(), 1, 'job should NOT be deleted yet');
});

test('a job IS deleted on the second Delete click', async () => {
  const client = makeClient('c1');
  const job = makeJob('j1', 'c1');
  const p = await freshPage({ clients: [client], jobs: [job] });

  await p.click('.job');
  await p.click('#deleteJobBtn'); // arm
  await p.click('#deleteJobBtn'); // confirm

  assert.equal(await p.isHidden('#jobModalBackdrop'), true, 'modal should close');
  assert.equal(await p.locator('.job').count(), 0, 'job should be gone');
});

test('a client with jobs cannot be deleted — guarded with an inline notice', async () => {
  const client = makeClient('c1');
  const job = makeJob('j1', 'c1');
  const p = await freshPage({ clients: [client], jobs: [job] });

  await p.click('button[data-tab="clients"]');
  await p.click('.edit-client');
  await p.click('#deleteClientBtn');

  assert.equal(await p.isVisible('#clientNotice'), true, 'guard notice should show');
  assert.equal(await p.isVisible('#clientModalBackdrop'), true, 'modal should stay open');
  assert.equal((await p.textContent('#deleteClientBtn')).trim(), 'Delete', 'should not arm — guard takes priority');
  await p.click('#cancelClientBtn'); // close the modal before checking the list behind it
  assert.equal(await p.locator('.client-row').count(), 1, 'client should NOT be deleted');
});

test('a client with no jobs requires two clicks to delete', async () => {
  const client = makeClient('c1');
  const p = await freshPage({ clients: [client], jobs: [] });

  await p.click('button[data-tab="clients"]');
  await p.click('.edit-client');

  await p.click('#deleteClientBtn'); // 1st click: arm only
  assert.equal(await p.isVisible('#clientModalBackdrop'), true, 'still open after 1 click');
  assert.equal(await p.locator('.client-row').count(), 1, 'not deleted after 1 click');

  await p.click('#deleteClientBtn'); // 2nd click: confirm
  assert.equal(await p.isHidden('#clientModalBackdrop'), true);
  assert.equal(await p.locator('.client-row').count(), 0, 'deleted after 2nd click');
});

test('creating a job with zero clients shows the "Add a client" recovery path, not a dead end', async () => {
  const p = await freshPage({ clients: [], jobs: [] });

  await p.click('#newJobBtn');
  assert.equal(await p.isVisible('#jobNoClientNotice'), true, 'notice should show');
  assert.equal(await p.isHidden('#jobClient'), true, 'empty select should be hidden, not just empty');
  assert.equal(await p.isDisabled('#saveJobBtn'), true, 'Save should be disabled — nothing to submit');

  await p.click('#jobNoClientAddBtn');
  assert.equal(await p.isHidden('#jobModalBackdrop'), true, 'New Job should close');
  assert.equal(await p.isVisible('#clientModalBackdrop'), true, 'New Client should open in its place');
  assert.equal((await p.textContent('#clientModalTitle')).trim(), 'New client');
});

test('"Needs attention" chips count unassigned, cancelled-this-week, today, and awaiting-confirmation jobs', async () => {
  const client = makeClient('c1');
  const jobs = [
    makeJob('j1', 'c1', { title: 'Unassigned', assignee: '' }), // unassigned + awaiting confirmation
    makeJob('j2', 'c1', { title: 'Cancelled', status: 'cancelled' }), // cancelled this week, excluded elsewhere
    makeJob('j3', 'c1', { title: 'Already confirmed', appointment_confirmation_status: 'confirmed' }), // NOT awaiting confirmation
    makeJob('j4', 'c1', { title: 'Plain job' }), // no confirmation field at all -> defaults to awaiting confirmation
  ];
  const p = await freshPage({ clients: [client], jobs });

  const naText = await p.locator('#needsAttentionGrid').innerText();
  assert.match(naText, /Unassigned jobs\s*\n\s*1/, 'exactly one unassigned job');
  assert.match(naText, /Cancelled this week\s*\n\s*1/, 'exactly one cancelled-this-week job');
  assert.match(naText, /Scheduled today\s*\n\s*3/, 'cancelled job excluded from today count');
  assert.match(naText, /Awaiting confirmation\s*\n\s*2/, 'the confirmed job is excluded, cancelled job is excluded');

  // Clicking a chip narrows Today/Upcoming to just that group.
  await p.locator('.needs-attention-card', { hasText: 'Unassigned jobs' }).click();
  assert.equal(await p.locator('#todayList .job').count(), 1, 'filtered list shows only the matching job');
  assert.equal((await p.textContent('#todayList')).includes('Unassigned'), true);
  await p.click('#homeFilterClearBtn');
  assert.equal(await p.isHidden('#homeFilterBanner'), true, 'clearing the filter hides the banner');
});

test('assigning a technician who already has jobs that day shows a non-blocking count warning', async () => {
  const client = makeClient('c1');
  const jobs = [
    makeJob('j1', 'c1', { title: 'Job A', assignee: 'Jordan Lee' }),
    makeJob('j2', 'c1', { title: 'Job B', assignee: 'Jordan Lee' }),
  ];
  const p = await freshPage({ clients: [client], jobs });

  await p.click('#newJobBtn');
  await p.fill('#jobTitle', 'Job C');
  await p.selectOption('#jobAssignee', 'Jordan Lee');
  const warning = (await p.textContent('#jobConflictWarning')).trim();
  assert.match(warning, /Jordan Lee already has 2 jobs on/, 'warns with the actual count, not just "a job"');
  assert.equal(await p.isDisabled('#saveJobBtn'), false, 'the warning is non-blocking — Save stays enabled once the other required fields are filled');
});

test('job cards show the job ID, the job-site address, and the phone number to call', async () => {
  const client = makeClient('c1', {
    name: 'Evergreen Properties', building_number: '482', street_name: 'Glenwood Ave',
    city: 'Raleigh', state: 'NC', zip_code: '27603', client_phone: '(919) 555-0142',
  });
  const job = makeJob('job_abc123', 'c1', { title: 'HVAC inspection' });
  const p = await freshPage({ clients: [client], jobs: [job] });

  const cardText = await p.locator('.job').first().innerText();
  assert.equal(cardText.includes('job_abc123'), true, 'shows the job ID');
  assert.equal(cardText.includes('482 Glenwood Ave, Raleigh, NC 27603'), true, 'shows the job-site address');
  assert.equal(cardText.includes('(919) 555-0142'), true, 'shows the phone number to call');
});

test('two jobs for the same tech on the same day but different times are NOT flagged as conflicting', async () => {
  const client = makeClient('c1');
  const jobs = [
    makeJob('j1', 'c1', { title: 'Morning job', assignee: 'Jordan Lee', scheduled_start_time: '09:00' }),
    makeJob('j2', 'c1', { title: 'Afternoon job', assignee: 'Jordan Lee', scheduled_start_time: '14:00' }),
  ];
  const p = await freshPage({ clients: [client], jobs });

  assert.equal(await p.locator('.job.is-conflict').count(), 0, 'different exact times are not a real double-booking');

  await p.click('#newJobBtn');
  await p.fill('#jobTitle', 'Job C');
  await p.selectOption('#jobAssignee', 'Jordan Lee');
  await p.fill('#jobStartTime', '11:00');
  assert.equal(await p.isHidden('#jobConflictWarning'), true, 'a third, non-overlapping time should not warn');
});

test('same tech, same day, AND same start time triggers the warning and names the time', async () => {
  const client = makeClient('c1');
  const jobs = [
    makeJob('j1', 'c1', { title: 'Morning job', assignee: 'Jordan Lee', scheduled_start_time: '09:00' }),
  ];
  const p = await freshPage({ clients: [client], jobs });

  await p.click('#newJobBtn');
  await p.fill('#jobTitle', 'Job C');
  await p.selectOption('#jobAssignee', 'Jordan Lee');
  await p.fill('#jobStartTime', '09:00');
  const warning = (await p.textContent('#jobConflictWarning')).trim();
  assert.match(warning, /Jordan Lee already has a job at 9:00 AM on/);
});

test('confirming an appointment stamps confirmed_at/confirmed_by and updates the badge', async () => {
  const client = makeClient('c1');
  const p = await freshPage({ clients: [client], jobs: [] });

  await p.click('#newJobBtn');
  await p.fill('#jobTitle', 'New job');
  await p.selectOption('#jobConfirmationStatus', 'confirmed');
  await p.fill('#jobConfirmedBy', 'Maya Chen');
  await p.click('#saveJobBtn');
  await p.locator('#jobModalBackdrop').waitFor({ state: 'hidden' });

  const badge = (await p.locator('.job', { hasText: 'New job' }).locator('.confirm-badge').textContent()).trim();
  assert.equal(badge, 'Confirmed');

  await p.locator('.job', { hasText: 'New job' }).click();
  const meta = (await p.textContent('#jobConfirmationMeta')).trim();
  assert.match(meta, /Confirmed .* by Maya Chen/);
});

test('a job with none of the new optional fields still renders and edits without errors', async () => {
  const client = makeClient('c1');
  // Deliberately no appointment_confirmation_status, contact_method, etc. —
  // simulates a job synced in before this feature existed.
  const legacyJob = { id: 'j1', account_id: ACCOUNT_ID, client_id: 'c1', title: 'Legacy job', scheduled_for: TODAY_ISO, status: 'scheduled', assignee: 'Maya Chen' };
  const errors = [];
  const p = await freshPage({ clients: [client], jobs: [legacyJob] });
  p.on('pageerror', (err) => errors.push(err.message));

  const badge = (await p.locator('.job').locator('.confirm-badge').textContent()).trim();
  assert.equal(badge, 'Needs confirmation', 'missing field defaults to the pending/needs-confirmation state');

  await p.click('.job');
  assert.equal(await p.locator('#jobConfirmationStatus').inputValue(), 'pending');
  await p.click('#saveJobBtn'); // re-saving a legacy job should not throw
  assert.equal(errors.length, 0, 'no page errors while rendering/editing a legacy job');
});

test('one company cannot see another company\'s Scheduling jobs/clients or needs-attention counts', async () => {
  const otherAccountId = 'acct_horizon';
  const seed = {
    clients: [makeClient('c1')],
    jobs: [makeJob('j1', 'c1', { title: 'Northstar job' })],
  };
  const otherSeed = {
    clients: [{ id: 'oc1', account_id: otherAccountId, name: 'Other Co Client', building_number: '', street_name: '', city: '', state: '', zip_code: '', client_phone: '' }],
    jobs: [{ id: 'oj1', account_id: otherAccountId, client_id: 'oc1', title: 'Other company job', scheduled_for: TODAY_ISO, status: 'scheduled', assignee: '' }],
  };
  if (page) await page.close();
  page = await browser.newPage();
  await page.addInitScript((state) => {
    window.name = JSON.stringify({ fieldflowMockData: { accounts: { acct_northstar: state.mine, [state.otherId]: state.theirs } } });
  }, { mine: seed, theirs: otherSeed, otherId: otherAccountId });
  await page.goto(BASE_URL + DEMO_QUERY); // demo_user=john is scoped to acct_northstar
  await page.waitForSelector('#schedulingApp:not([hidden])');

  const homeText = await page.textContent('#homeView');
  assert.equal(homeText.includes('Northstar job'), true, 'own job is visible');
  assert.equal(homeText.includes('Other company job'), false, 'other account\'s job must not leak into this view');

  // The other account's unassigned job must not inflate this account's count.
  const naText = await page.locator('#needsAttentionGrid').innerText();
  assert.match(naText, /Unassigned jobs\s*\n\s*0/, 'other account\'s unassigned job is not counted here');
});

test('modals stay on-screen after scrolling down a long page', async () => {
  const clients = Array.from({ length: 12 }, (_, i) => makeClient('c' + i));
  const p = await freshPage({ clients, jobs: [] });
  await p.setViewportSize({ width: 1280, height: 500 });

  await p.click('button[data-tab="clients"]');
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const lastEdit = p.locator('.edit-client').last();
  await lastEdit.click(); // clicking a row that's already on-screen at this scroll position

  const box = await p.locator('#clientModalCard').boundingBox();
  assert.ok(box, 'modal card should have a bounding box (be rendered)');
  const viewport = p.viewportSize();
  assert.ok(
    box.y >= 0 && box.y + box.height <= viewport.height,
    `modal should be fully within the ${viewport.height}px viewport, got y=${box.y} height=${box.height}`
  );
});
