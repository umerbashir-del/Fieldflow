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
