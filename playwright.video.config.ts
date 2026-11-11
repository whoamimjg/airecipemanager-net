import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/video-import',
  use: { baseURL: 'http://127.0.0.1:8080', headless: true, launchOptions: { executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] } },
  webServer: { command: 'npm run dev -- --host 127.0.0.1', url: 'http://127.0.0.1:8080', reuseExistingServer: true },
});
