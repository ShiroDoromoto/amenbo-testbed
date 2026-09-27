import { defineConfig, devices } from '@playwright/test';

const port = 5317;

export default defineConfig({
  testDir: 'e2e',
  use: {
    baseURL: `http://localhost:${port}`,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run dev -- --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
  },
});
