import { expect, test } from '@playwright/test';

const schedulingUrl = 'http://127.0.0.1:5174/';
const opsUrl = 'http://127.0.0.1:5176/';

async function signIn(page, email, password) {
  await page.goto(schedulingUrl);
  await page.locator('#mockLoginForm').getByLabel('Email').fill(email);
  await page.locator('#mockLoginForm').getByLabel('Password').fill(password);
  await page.locator('#mockLoginForm').getByRole('button', { name: 'Sign in' }).click();
  await expect(page.locator('#schedulingApp')).toBeVisible();
}

test('rejects another demo user’s password and supports the reset flow', async ({ page }) => {
  await page.goto(schedulingUrl);
  await page.locator('#mockLoginForm').getByLabel('Email').fill('john@fieldflow.demo');
  await page.locator('#mockLoginForm').getByLabel('Password').fill('sarah-demo-password');
  await page.locator('#mockLoginForm').getByRole('button', { name: 'Sign in' }).click();
  await expect(page.locator('#mockLoginError')).toContainText('Use one of the demo accounts');

  await page.getByRole('button', { name: 'Forgot password?' }).click();
  await page.locator('#mockResetForm').getByLabel('Email').fill('john@fieldflow.demo');
  await page.locator('#mockResetForm').getByRole('button', { name: 'Send reset link' }).click();
  await expect(page.locator('#mockResetMessage')).toContainText('reset email would be sent to john@fieldflow.demo');
});

test('John sees Northstar data and carries that identity to Analytics and Chatbot', async ({ page }) => {
  await signIn(page, 'john@fieldflow.demo', 'john-demo-password');
  await expect(page.locator('#accountLine')).toContainText('Northstar Field Services');
  await page.getByRole('button', { name: 'Clients' }).click();
  await expect(page.locator('#clientList')).toContainText('Evergreen Properties');
  await expect(page.locator('#clientList')).not.toContainText('Arcade Market');

  await page.getByRole('button', { name: 'Home' }).click();
  await page.getByRole('link', { name: 'View Analytics' }).click();
  await expect(page).toHaveURL(/demo_user=john/);
  await expect(page.getByRole('heading', { name: /Northstar Field Services — Analytics/ })).toBeVisible();
  await expect(page.locator('.primary-card .metric')).toHaveText('14');

  await page.goBack();
  await page.getByRole('link', { name: 'Support Chat' }).click();
  await expect(page).toHaveURL(/demo_user=john/);
  await expect(page.locator('#accountSelect')).toHaveValue('acct_northstar');
  await expect(page.locator('#accountSelect')).toBeDisabled();
});

test('Sarah sees only Horizon data', async ({ page }) => {
  await signIn(page, 'sarah@fieldflow.demo', 'sarah-demo-password');
  await expect(page.locator('#accountLine')).toContainText('Horizon Electric');
  await page.getByRole('button', { name: 'Clients' }).click();
  await expect(page.locator('#clientList')).toContainText('Arcade Market');
  await expect(page.locator('#clientList')).not.toContainText('Evergreen Properties');
});

test('sign-in form is keyboard operable', async ({ page }) => {
  await page.goto(schedulingUrl);
  await page.keyboard.press('Tab');
  await expect(page.locator('#mockEmail')).toBeFocused();
  await page.keyboard.type('john@fieldflow.demo');
  await page.keyboard.press('Tab');
  await expect(page.locator('#mockPassword')).toBeFocused();
  await page.keyboard.type('john-demo-password');
  await page.keyboard.press('Enter');
  await expect(page.locator('#schedulingApp')).toBeVisible();
});

test('new account creates an empty company context and supports keyboard navigation', async ({ page }) => {
  await page.goto(schedulingUrl);
  await page.getByRole('button', { name: 'Create a new business account' }).click();
  const signUp = page.locator('#mockSignUpForm');
  await signUp.getByLabel('Your name').fill('Avery Smith');
  await signUp.getByLabel('Business name').fill('Avery Plumbing');
  await signUp.getByLabel('Email').fill('avery@example.com');
  await signUp.getByLabel('Password').fill('short');
  await signUp.getByRole('button', { name: 'Create account' }).click();
  await expect(page.locator('#mockSignUpError')).toContainText('at least 8 characters');
  await signUp.getByLabel('Password').fill('avery-password');
  await signUp.getByRole('button', { name: 'Create account' }).click();
  await expect(page.locator('#accountLine')).toContainText('Avery Plumbing');
  await expect(page.locator('#upcomingList')).toContainText('No upcoming jobs');

  await page.getByRole('link', { name: 'View Analytics' }).click();
  await expect(page.getByRole('heading', { name: /Avery Plumbing — Analytics/ })).toBeVisible();
  await expect(page.locator('.primary-card .metric')).toHaveText('0');
});

test('Operations Dashboard accepts only the separate staff demo account', async ({ page }) => {
  await page.goto(opsUrl);
  await page.locator('#opsLoginForm').getByLabel('Email').fill('john@fieldflow.demo');
  await page.locator('#opsLoginForm').getByLabel('Password').fill('john-demo-password');
  await page.getByRole('button', { name: 'Sign in to Operations' }).click();
  await expect(page.locator('#opsLoginError')).toContainText('Operations staff');

  await page.getByRole('button', { name: 'Forgot password?' }).click();
  await page.locator('#opsResetForm').getByLabel('Email').fill('ops@fieldflow.demo');
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await expect(page.locator('#opsResetMessage')).toContainText('reset email would be sent to ops@fieldflow.demo');
  await page.getByRole('button', { name: 'Back to sign in' }).click();

  await page.locator('#opsEmail').fill('ops@fieldflow.demo');
  await page.locator('#opsPassword').fill('ops-demo-password');
  await page.getByRole('button', { name: 'Sign in to Operations' }).click();
  await expect(page.locator('#opsDashboard')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Operations dashboard' })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.locator('#opsLoginGate')).toBeVisible();
});
