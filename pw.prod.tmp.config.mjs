import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  testMatch: ['**/vivo.e2e.js', '**/vivoSombra.e2e.js'],
  timeout: 300_000, expect: { timeout: 20_000 }, retries: 0, reporter: 'line', workers: 1,
  use: { baseURL: 'https://costeador-vonhaucke.vercel.app', trace: 'retain-on-failure', screenshot: 'only-on-failure', ...devices['Desktop Chrome'], launchOptions: { executablePath: '/opt/pw-browsers/chromium' } },
  outputDir: '/tmp/claude-0/-home-user-costeador-vonhaucke/4ebe1775-de26-5cdd-8f53-1edeaa08f67a/scratchpad/audit/pw-out',
});
