// Playwright contra el CLIENTE PUBLICADO (Vercel), no el dev server. Mismos specs de e2e/.
// Uso: PROD_URL=https://costeador-vonhaucke.vercel.app EDGE_REAL=1 npx playwright test --config playwright.prod.config.js e2e/golden757.e2e.js
import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.js',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  retries: 0,
  reporter: 'list',
  outputDir: process.env.PW_OUT || 'test-results-prod',
  use: { baseURL: process.env.PROD_URL || 'https://costeador-vonhaucke.vercel.app', trace: 'off', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], ...(process.env.PW_EXECUTABLE ? { launchOptions: { executablePath: process.env.PW_EXECUTABLE } } : {}) } }],
});
