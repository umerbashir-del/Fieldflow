import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = Object.fromEntries(
  (await readFile(path.join(root, '.env'), 'utf8')).split(/\r?\n/)
    .map((line) => line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/))
    .filter(Boolean)
    .map((match) => [match[1], match[2].replace(/^['"]|['"]$/g, '')]),
);
const baseUrl = (process.env.FIELDFLOW_DEPLOYMENT_URL ?? '').replace(/\/$/, '');
if (!baseUrl) throw new Error('Set FIELDFLOW_DEPLOYMENT_URL to the deployed site URL.');

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const browserProblems = [];
page.on('pageerror', (error) => browserProblems.push(`page error: ${error.message}`));
page.on('requestfailed', (request) => browserProblems.push(`request failed: ${request.url()} (${request.failure()?.errorText})`));

async function contractorFlow(email, password, expectedCompany, forbiddenCompany) {
  await page.goto(`${baseUrl}/scheduling/`);
  await page.locator('#mockEmail').fill(email);
  await page.locator('#mockPassword').fill(password);
  await page.locator('#mockLoginForm button[type="submit"]').click();
  try {
    await page.locator('#schedulingApp').waitFor({ state: 'visible', timeout: 15_000 });
  } catch (error) {
    const loginError = (await page.locator('#mockLoginError').textContent())?.trim();
    throw new Error(`Production sign-in failed for ${email}: ${loginError || browserProblems.join('; ') || error.message}`);
  }
  await page.waitForFunction(
    (company) => document.querySelector('#accountLine')?.textContent?.includes(company),
    expectedCompany,
  );
  const accountLine = await page.locator('#accountLine').textContent();
  if (!accountLine?.includes(expectedCompany) || accountLine.includes(forbiddenCompany)) {
    throw new Error(`${expectedCompany} contractor account was not isolated correctly. Scheduling showed: ${accountLine}`);
  }
  const analyticsLink = page.getByRole('link', { name: 'View Analytics' });
  await page.waitForFunction(() => document.querySelector('#analyticsLink')?.getAttribute('href') !== '#');
  const analyticsHref = await analyticsLink.getAttribute('href');
  if (!analyticsHref || analyticsHref === '#') {
    throw new Error(`Scheduling navigation was not initialized: ${browserProblems.join('; ') || 'no browser error was reported'}`);
  }
  await analyticsLink.click();
  try {
    await page.getByRole('heading', { name: new RegExp(expectedCompany) }).waitFor({ timeout: 15_000 });
  } catch {
    const pageText = (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 500);
    throw new Error(`Analytics handoff failed at ${page.url()}: ${pageText || browserProblems.join('; ') || 'blank page'}`);
  }
  await page.goto(`${baseUrl}/support/`);
  await page.locator('#chatApp').waitFor({ state: 'visible' });
  const selectedAccount = await page.locator('#accountSelect').textContent();
  if (!selectedAccount?.includes(expectedCompany) || selectedAccount.includes(forbiddenCompany)) {
    throw new Error(`${expectedCompany} Chatbot context was not isolated correctly.`);
  }
  await page.locator('#chatSignOutBtn').click();
  await page.waitForURL(/\/scheduling\//);
  await page.locator('#mockLoginGate').waitFor({ state: 'visible' });
}

try {
  await contractorFlow(env.JOHN_TEST_EMAIL, env.JOHN_TEST_PASSWORD, 'Northstar Field Services', 'Horizon Electric');
  await contractorFlow(env.SARAH_TEST_EMAIL, env.SARAH_TEST_PASSWORD, 'Horizon Electric', 'Northstar Field Services');

  await page.goto(`${baseUrl}/operations/`);
  await page.locator('#opsEmail').fill(env.OPERATIONS_TEST_EMAIL);
  await page.locator('#opsPassword').fill(env.OPERATIONS_TEST_PASSWORD);
  await page.locator('#opsLoginForm button[type="submit"]').click();
  await page.locator('#opsDashboard').waitFor({ state: 'visible' });
  await page.waitForFunction(() => {
    const text = document.querySelector('#opsDashboard')?.textContent ?? '';
    return text.includes('Northstar Field Services') && text.includes('Horizon Electric');
  });
  const dashboardText = await page.locator('#opsDashboard').textContent();
  if (!dashboardText?.includes('Northstar Field Services') || !dashboardText.includes('Horizon Electric')) {
    throw new Error('Operations did not receive the expected cross-account view.');
  }

  console.log('Deployment verified: John, Sarah, Analytics, Chatbot, and Operations use isolated live Supabase sessions.');
} finally {
  await browser.close();
}
