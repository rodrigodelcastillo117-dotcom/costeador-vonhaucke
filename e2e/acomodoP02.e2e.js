import { test, expect } from '@playwright/test';

// ============================================================================
//  E2E P0.2 (obj 13) — ACOMODO en navegador real, verify-first, SIN edge vivo.
//
//  Route-mockea `acomodar-espacio-recovery` (no toca la Edge viva) y maneja el
//  flujo real: home → Voni → paso 3 (Acomodo). Multi-área fuerza el motor
//  espacial, que pega al mock. Certifica que el wiring del bloque D corre VIVO:
//  sella program_hash/floor_hash en el plan persistido (obj10) y la validez sale
//  del agregador verify-first, no de creer al edge (obj11).
//
//  Único skip permitido: ausencia de credenciales (login real).
// ============================================================================
const EMAIL = process.env.TEST_EMAIL;
const PASS = process.env.TEST_PASSWORD;
const hayCreds = !!(EMAIL && PASS);

const CLAVE = 'costeador-vonhaucke-v1';

// Proyecto CONFIRMADO + FloorSpec multi-área (sin plan: el solver debe correr).
const ESTADO_SEMILLA = {
  onboardingVisto: true,
  cotizacion: {
    partidas: [
      { id: 'w', piezaId: 'silla-win', nombre: 'Silla operativa WIN', cantidad: 2, precioUnitario: 5210 },
      { id: 'm', piezaId: 'mj-2400x1200', nombre: 'Mesa de juntas', cantidad: 1, w: 2400, d: 1200, precioUnitario: 5510 },
    ],
    acomodo: {
      areasM: [
        { nombre: 'OPERATIVA', tipo: 'open', ancho: 8, largo: 4 },
        { nombre: 'JUNTAS', tipo: 'juntas', ancho: 5, largo: 4 },
      ],
    },
  },
};

// Plan válido devuelto por el mock (ids = expandirPiezas: w-1,w-2 sillas; m-1 mesa).
const PLAN_MOCK = {
  ok: true,
  plan: {
    colocacion: [
      { id: 'w-1', area: 0, x: 0, y: 1500, rot: 0 },
      { id: 'w-2', area: 0, x: 1000, y: 1500, rot: 0 },
      { id: 'm-1', area: 1, x: 0, y: 0, rot: 0 },
    ],
    caben: true,
  },
  layoutSpec: { version: 'PLACEMENT_SPEC_V2', status: 'PASS', requested: 3, placed: 3, unplaced: [], validation: { render_ready: true, invariant_ok: true } },
  render_ready: true, strictPlacement: true, completo: true, colocadas: 3, total: 3, noColocadas: [],
};

const leerPlan = (page) => page.evaluate((clave) => {
  try { return JSON.parse(window.localStorage.getItem(clave))?.cotizacion?.acomodo?.plan || null; } catch (_e) { return null; }
}, CLAVE);

test.describe('E2E P0.2 · acomodo verify-first (navegador real)', () => {
  test.skip(!hayCreds, 'Define TEST_EMAIL y TEST_PASSWORD para correr el gate E2E real.');

  test('el solver corre, el cliente verifica y sella program_hash/floor_hash en el plan persistido', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e?.message || e)));

    await page.addInitScript(([clave, estado]) => {
      try { if (!window.localStorage.getItem(clave)) window.localStorage.setItem(clave, JSON.stringify(estado)); } catch (_e) { /* modo privado */ }
    }, [CLAVE, ESTADO_SEMILLA]);

    // Intercepta el solver: NADA sale a la Edge viva.
    let golpes = 0;
    await page.route('**/functions/v1/acomodar-espacio-recovery', async (route) => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
      golpes += 1;
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(PLAN_MOCK) });
    });

    await page.goto('/');
    await page.fill('#email-login', EMAIL);
    await page.fill('#pass-login', PASS);
    await page.getByRole('button', { name: /^Entrar$/i }).click();
    await expect(page.getByRole('button', { name: /Salir/i })).toBeVisible({ timeout: 20000 });

    // home → Voni → paso 2 (Muebles) → paso 3 (Acomodo).
    await page.getByTestId('home-cotizar').click();
    await page.getByText(/^Muebles$/).first().click();
    await page.getByText(/^Acomodo$/).first().click();

    // El motor espacial (multi-área) corre y pega al mock.
    await expect.poll(() => golpes, { timeout: 20000 }).toBeGreaterThanOrEqual(1);

    // Bloque D VIVO: el plan persistido trae ambos hashes sellados.
    await expect.poll(async () => (await leerPlan(page))?.program_hash || '', { timeout: 15000 }).toMatch(/^p_/);
    const plan = await leerPlan(page);
    expect(plan.floor_hash).toMatch(/^f_/);
    expect(Array.isArray(plan.colocacion)).toBe(true);
    expect(plan.colocacion.length).toBe(3);

    expect(pageErrors, pageErrors.join('\n')).toHaveLength(0);
  });
});
