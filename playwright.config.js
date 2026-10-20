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

// Auditoría ChatGPT 19-oct ("12 skipped opacos"): los LABORATORIOS contra producción y las pasadas en vivo no son
// pruebas del CI: cuestan IA/renders y necesitan su propio insumo (plano, imagen, brief, cliente). Antes entraban a
// cada corrida y salían "skipped". Ahora sólo se cargan cuando quien los corre los pide con su variable (LAB_* lo
// pone lab/certificacion/caso.sh y lab/noche/*; VIVO / LIVE_AI / RENDER_PROD / COCREAR_QA, a mano). Inventario y
// razones: docs/auditoria/SKIPS_E2E.md.
const A_PEDIDO = /(^|[\\/])(lab[A-Z]\w*|vivo|vivoSombra|live-ai-smoke|renderEscenas|cocrearExpediente)\.e2e\.js$/;
const pidioAPedido = Object.keys(process.env).some((k) => /^LAB_/.test(k)) || ['VIVO', 'LIVE_AI', 'RENDER_PROD', 'COCREAR_QA'].some((k) => process.env[k]);
// E2E_PORT: otro puerto para el dev server (varias copias del repo/worktrees corriendo e2e a la vez sin que una
// reutilice el servidor de la otra y pruebe código ajeno). Por omisión 5173, como siempre.
const PUERTO = Number(process.env.E2E_PORT) || 5173;

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.js',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  // P1-LAB-COC-09 (cierre ChatGPT v3): una CERTIFICACIÓN no reintenta. Si corre un laboratorio (LAB_*) o la
  // certificación (CERTIFICACION=1), retries = 0 venga de donde venga la llamada: un primer intento FAIL reprueba el job
  // (lo comprueba e2e/labMetaReintento.e2e.js en el job `plan` de certificacion.yml). El CI normal conserva 1 reintento.
  retries: (pidioAPedido || process.env.CERTIFICACION === '1') ? 0 : (process.env.CI ? 1 : 0),
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    // Cierre ChatGPT (P1-REL-01): E2E_BASE_URL = la Vercel PREVIEW del FINAL_SHA; entonces no se levanta vite local.
    baseURL: process.env.E2E_BASE_URL || `http://localhost:${PUERTO}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  // Cierre GO (14-oct): golden757Edicion edita el presupuesto que CREA golden757. Antes corrían en paralelo y la edición
  // buscaba "el golden más reciente con acomodo" entre datos compartidos de la nube: si golden757 aún no acomodaba, las 6
  // tarjetas recientes estaban a medias y fallaba (flaky en CI 786 y 789). Ahora la edición es un proyecto que DEPENDE de
  // golden757 y abre EXACTAMENTE el presupuesto que éste dejó (su id), sin carrera ni estado ajeno.
  projects: [
    { name: 'chromium', testIgnore: [/golden757(Edicion)?\.e2e\.js$/, ...(pidioAPedido ? [] : [A_PEDIDO])], use: NAVEGADOR },
    { name: 'golden757', testMatch: /golden757\.e2e\.js$/, use: NAVEGADOR },
    { name: 'golden757-edicion', testMatch: /golden757Edicion\.e2e\.js$/, dependencies: ['golden757'], use: NAVEGADOR },
  ],
  ...(process.env.E2E_BASE_URL ? {} : { webServer: {
    command: PUERTO === 5173 ? 'npm run dev' : `npm run dev -- --port ${PUERTO} --strictPort`,
    url: `http://localhost:${PUERTO}`,
    reuseExistingServer: true,
    timeout: 60_000,
  } }),
});
