import { defineConfig } from '@playwright/test';

// Focused mocked-data checks, isolated from Chris's normal localhost server.
export default defineConfig({
  testDir: './e2e',
  testMatch: 'intake-planning.spec.ts',
  outputDir: '/tmp/tenops-intake-planning-results',
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3100',
    viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'PORT=3100 node tests/support/static-server.mjs',
    cwd: process.cwd(),
    url: 'http://localhost:3100',
    reuseExistingServer: false,
  },
});
