import { defineConfig } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3101';
const externalServerMode = process.env.E2E_EXTERNAL_SERVER === '1';

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup',
  use: {
    baseURL,
    storageState: 'playwright/.auth/user.json',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: externalServerMode
    ? undefined
    : {
        command: 'PORT=3101 npm run dev',
        url: baseURL,
        timeout: 180_000,
        reuseExistingServer: false,
      },
});
