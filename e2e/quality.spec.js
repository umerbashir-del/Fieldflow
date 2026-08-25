import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const schedulingUrl = 'http://127.0.0.1:5174/';

async function signIn(page) {
  await page.goto(schedulingUrl);
  await page.locator('#mockLoginForm').getByLabel('Email').fill('john@fieldflow.demo');
  await page.locator('#mockLoginForm').getByLabel('Password').fill('john-demo-password');
  await page.locator('#mockLoginForm').getByRole('button', { name: 'Sign in' }).click();
  await expect(page.locator('#schedulingApp')).toBeVisible();
}

test('validates required and bounded Scheduling inputs', async ({ page }) => {
  await signIn(page);
  await page.locator('#newJobBtn').click();
  await expect(page.locator('#saveJobBtn')).toBeDisabled();
  await page.locator('#jobTitle').fill('x'.repeat(200));
  await expect(page.locator('#jobTitle')).toHaveValue('x'.repeat(120));
  expect(await page.locator('#jobDate').evaluate((input) => {
    input.value = 'not-a-date';
    return input.value;
  })).toBe('');
  await page.locator('#jobDate').fill('');
  await expect(page.locator('#saveJobBtn')).toBeDisabled();
  await page.locator('#jobDate').fill('2026-08-25');
  await expect(page.locator('#saveJobBtn')).toBeEnabled();
  await page.locator('#cancelJobBtn').click();

  await page.getByRole('button', { name: 'Clients' }).click();
  await page.locator('#newClientBtn').click();
  await page.locator('#clientName').fill('Evergreen Properties');
  await page.locator('#saveClientBtn').click();
  await expect(page.locator('#clientNotice')).toContainText('already exists');
});

test('password reset validates email format without sending a request', async ({ page }) => {
  await page.goto(schedulingUrl);
  await page.getByRole('button', { name: 'Forgot password?' }).click();
  const resetForm = page.locator('#mockResetForm');
  const resetEmail = resetForm.getByLabel('Email');
  await resetEmail.fill('not-an-email');
  await resetForm.getByRole('button', { name: 'Send reset link' }).click();
  expect(await resetEmail.evaluate((input) => input.validationMessage)).not.toBe('');
  await expect(page.locator('#mockResetMessage')).toBeEmpty();
});

test('Chatbot clearly gates unauthenticated users', async ({ page }) => {
  await page.goto('http://127.0.0.1:5175/');
  await expect(page.locator('#chatLoginGate')).toBeVisible();
  await expect(page.locator('#chatLoginGate')).toContainText('Sign in through Scheduling first so Support can use your company’s context.');
  await expect(page.locator('#chatApp')).toBeHidden();
});

test('unknown routes show the FieldFlow 404 page and navigation', async ({ page }) => {
  test.skip(!process.env.FIELDFLOW_DEPLOYMENT_URL, 'The assembled Vercel deployment is required for custom 404 routing.');
  const deploymentUrl = process.env.FIELDFLOW_DEPLOYMENT_URL.replace(/\/$/, '');
  await page.goto(`${deploymentUrl}/this-page-does-not-exist`);
  await expect(page).toHaveTitle('FieldFlow — Page not found');
  await expect(page.getByRole('heading', { name: 'We couldn’t find that page.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Scheduling' })).toHaveAttribute('href', '/scheduling/');
  await expect(page.getByRole('link', { name: 'Analytics' })).toHaveAttribute('href', '/analytics/');
  await expect(page.getByRole('link', { name: 'Support' })).toHaveAttribute('href', '/support/');
});

for (const viewport of [
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
]) {
  test(`Scheduling remains usable at ${viewport.name} size`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await signIn(page);
    await expect(page.locator('#newJobBtn')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test(`all FieldFlow products avoid horizontal overflow at ${viewport.name} size`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const pages = [
      'http://127.0.0.1:5173/?demo_user=john&account_id=acct_northstar',
      'http://127.0.0.1:5175/?demo_user=john&account_id=acct_northstar',
      'http://127.0.0.1:5176/?demo_user=ops',
    ];
    for (const url of pages) {
      await page.goto(url);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${url} overflowed at ${viewport.name} size`).toBeLessThanOrEqual(1);
    }
  });
}

test('light-mode sign-in and Analytics meet automated color-contrast checks', async ({ page }) => {
  await page.goto(schedulingUrl);
  const signInResults = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
  expect(signInResults.violations).toEqual([]);

  await signIn(page);
  const schedulingResults = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
  expect(schedulingResults.violations).toEqual([]);
  await page.getByRole('link', { name: 'View Analytics' }).click();
  const analyticsResults = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
  expect(analyticsResults.violations).toEqual([]);
});

test('all application shells load within the local performance budget', async ({ page }) => {
  for (const url of [schedulingUrl, 'http://127.0.0.1:5173/', 'http://127.0.0.1:5175/', 'http://127.0.0.1:5176/']) {
    const started = Date.now();
    await page.goto(url);
    await page.locator('body').waitFor();
    expect(Date.now() - started, `${url} exceeded the load budget`).toBeLessThan(5_000);
  }
});
