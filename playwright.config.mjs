import { defineConfig, devices } from '@playwright/test';

const demoEnv = {
  ...process.env,
  VITE_SUPABASE_URL: '',
  VITE_SUPABASE_PUBLISHABLE_KEY: '',
  VITE_SUPABASE_ANON_KEY: '',
};

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { headless: true, trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: [
    { command: 'npm run dev --workspace=@fieldflow/scheduling -- --host 127.0.0.1 --port 5174', url: 'http://127.0.0.1:5174', reuseExistingServer: true, env: demoEnv },
    { command: 'npm run dev --workspace=@fieldflow/analytics -- --host 127.0.0.1 --port 5173', url: 'http://127.0.0.1:5173', reuseExistingServer: true, env: demoEnv },
    { command: 'npm run dev --workspace=@fieldflow/chatbot -- --host 127.0.0.1 --port 5175', url: 'http://127.0.0.1:5175', reuseExistingServer: true, env: demoEnv },
    { command: 'npm run dev --workspace=@fieldflow/ops-dashboard -- --host 127.0.0.1 --port 5176', url: 'http://127.0.0.1:5176', reuseExistingServer: true, env: demoEnv },
  ],
});
