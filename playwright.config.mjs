import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  use: { browserName: 'chromium', headless: true },
  webServer: [
    { command: 'npm run dev --workspace=@fieldflow/scheduling -- --host 127.0.0.1 --port 5174', url: 'http://127.0.0.1:5174', reuseExistingServer: true },
    { command: 'npm run dev --workspace=@fieldflow/analytics -- --host 127.0.0.1 --port 5173', url: 'http://127.0.0.1:5173', reuseExistingServer: true },
    { command: 'npm run dev --workspace=@fieldflow/chatbot -- --host 127.0.0.1 --port 5175', url: 'http://127.0.0.1:5175', reuseExistingServer: true },
    { command: 'npm run dev --workspace=@fieldflow/ops-dashboard -- --host 127.0.0.1 --port 5176', url: 'http://127.0.0.1:5176', reuseExistingServer: true },
  ],
});
