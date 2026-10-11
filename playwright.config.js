import { defineConfig, devices } from '@playwright/test';

// E2E real en navegador (Chromium). Los specs se llaman *.e2e.js para NO chocar con
// vitest (que corre *.test.js). Playwright levanta el dev server solo y lo reutiliza
// si ya está arriba. Pensado también para CI (headless).
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.js',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{
    name: 'chromium',
    use: {
      ...devices['Desktop Chrome'],
      // Entornos con un Chromium ya instalado en otra ruta (sin `playwright install`):
      // PW_EXECUTABLE=/ruta/al/chromium npm run e2e
      ...(process.env.PW_EXECUTABLE ? { launchOptions: { executablePath: process.env.PW_EXECUTABLE } } : {}),
    },
  }],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
