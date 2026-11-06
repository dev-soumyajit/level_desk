import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  timeout: 60000,
  use: { baseURL: 'http://127.0.0.1:3000', trace: 'retain-on-failure', channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium', channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' } }
  ],
  webServer: { command: 'npm run dev', url: 'http://127.0.0.1:3000', reuseExistingServer: !process.env.CI, timeout: 120000 }
});
