import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:1107';

export default defineConfig({
  testDir: './e2e',
  timeout: 20_000,
  use: { baseURL, trace: 'retain-on-failure' },
  webServer: {
    command: 'vite --host 127.0.0.1 --port 1107',
    url: baseURL,
    reuseExistingServer: true,
  },
  projects: [
    { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
    {
      name: 'tablet-chrome',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1024, height: 768 },
        deviceScaleFactor: 2,
        hasTouch: true,
      },
    },
    { name: 'desktop-chrome', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'projector-chrome',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 } },
    },
  ],
});
