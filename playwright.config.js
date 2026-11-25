import { defineConfig, devices } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const dataDir = join(root, 'test-results', 'data');
mkdirSync(dataDir, { recursive: true });

const env = {
  ...process.env,
  APP_SECRET: randomBytes(32).toString('base64url'),
  CRON_SECRET: randomBytes(24).toString('base64url'),
  SQLITE_STORAGE: join(dataDir, `e2e-${Date.now()}.sqlite`),
  PORT: '5055',
};

export default defineConfig({
  testDir: './e2e',
  // The PWA suite needs the production build; it has its own config (playwright.pwa.config.js).
  testIgnore: /pwa\.spec\.js/,
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:5174',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node ./e2e/server.js',
      url: 'http://127.0.0.1:5055/api/health',
      env,
      timeout: 60_000,
      reuseExistingServer: false,
    },
    {
      command: 'npx vite --host 127.0.0.1 --port 5174 --strictPort',
      url: 'http://127.0.0.1:5174',
      env: { ...env, API_PROXY_TARGET: 'http://127.0.0.1:5055' },
      timeout: 60_000,
      reuseExistingServer: false,
    },
  ],
});
