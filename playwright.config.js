import { defineConfig, devices } from '@playwright/test';

// E2E real en navegador (Chromium). Los specs se llaman *.e2e.js para NO chocar con
// vitest (que corre *.test.js). Playwright levanta el dev server solo y lo reutiliza
// si ya está arriba. Pensado también para CI (headless).
const NAVEGADOR = {
  ...devices['Desktop Chrome'],
  // Entornos con un Chromium ya instalado en otra ruta (sin `playwright install`):
  // PW_EXECUTABLE=/ruta/al/chromium npm run e2e
  ...(process.env.PW_EXECUTABLE ? { launchOptions: { executablePath: process.env.PW_EXECUTABLE } } : {}),
};

// Puerto del dev server: 5173 por defecto. E2E_PORT=xxxx permite correr dos checkouts a la vez sin que
// `reuseExistingServer` reutilice el vite de OTRO árbol (se probaría código ajeno).
const PUERTO = Number(process.env.E2E_PORT) || 5173;

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.js',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PUERTO}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  // Cierre GO (14-oct): golden757Edicion edita el presupuesto que CREA golden757. Antes corrían en paralelo y la edición
  // buscaba "el golden más reciente con acomodo" entre datos compartidos de la nube: si golden757 aún no acomodaba, las 6
  // tarjetas recientes estaban a medias y fallaba (flaky en CI 786 y 789). Ahora la edición es un proyecto que DEPENDE de
  // golden757 y abre EXACTAMENTE el presupuesto que éste dejó (su id), sin carrera ni estado ajeno.
  projects: [
    { name: 'chromium', testIgnore: /golden757(Edicion)?\.e2e\.js$/, use: NAVEGADOR },
    { name: 'golden757', testMatch: /golden757\.e2e\.js$/, use: NAVEGADOR },
    { name: 'golden757-edicion', testMatch: /golden757Edicion\.e2e\.js$/, dependencies: ['golden757'], use: NAVEGADOR },
  ],
  webServer: {
    command: PUERTO === 5173 ? 'npm run dev' : `npm run dev -- --port ${PUERTO} --strictPort`,
    url: `http://localhost:${PUERTO}`,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
