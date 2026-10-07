import { test, expect } from '@playwright/test';

// ============================================================================
//  E2E P0.2 (audit H) — ACOMODO verify-first en navegador real, SIN edge vivo.
//
//  Cadena certificada: navegador → Voni paso 3 (Acomodo) → puerta única
//  (ejecutarAcomodo) → orquestador → recovery edge MOCKEADO → agregador de
//  invariantes → hashes → estado persistido.
//
//  Dos mocks:
//   1) BUENO: plan válido → el cliente persiste PASS con program_hash/floor_hash.
//   2) MENTIROSO: el edge dice PASS/render_ready=true pero devuelve OVERLAP. El
//      cliente DEBE bajarlo (verify-first) y NO persistir como válido.
//
//  Diagnóstico: justo tras login se afirma que el fixture (partidas + areasM)
//  SOBREVIVIÓ la hidratación; si el servidor lo pisara, el assert lo demuestra.
//  Único skip permitido: ausencia de credenciales.
// ============================================================================
const EMAIL = process.env.TEST_EMAIL;
const PASS = process.env.TEST_PASSWORD;
const hayCreds = !!(EMAIL && PASS);
const CLAVE = 'costeador-vonhaucke-v1';

const SEMILLA = {
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

const planBueno = {
  ok: true,
  plan: { colocacion: [
    { id: 'w-1', area: 0, x: 0, y: 1500, rot: 0 },
    { id: 'w-2', area: 0, x: 2000, y: 1500, rot: 0 },
    { id: 'm-1', area: 1, x: 0, y: 0, rot: 0 },
  ], caben: true },
  layoutSpec: { version: 'PLACEMENT_SPEC_V2', status: 'PASS', requested: 3, placed: 3, unplaced: [], validation: { render_ready: true, invariant_ok: true } },
  render_ready: true, strictPlacement: true, completo: true, colocadas: 3, total: 3, noColocadas: [],
};

// MENTIROSO: dice PASS/render_ready pero w-1 y w-2 se solapan (mismo punto).
const planMentiroso = {
  ok: true,
  plan: { colocacion: [
    { id: 'w-1', area: 0, x: 0, y: 1500, rot: 0 },
    { id: 'w-2', area: 0, x: 0, y: 1500, rot: 0 },  // OVERLAP con w-1
    { id: 'm-1', area: 1, x: 0, y: 0, rot: 0 },
  ], caben: true },
  layoutSpec: { version: 'PLACEMENT_SPEC_V2', status: 'PASS', requested: 3, placed: 3, unplaced: [], validation: { render_ready: true, invariant_ok: true } },
  render_ready: true, strictPlacement: true, completo: true, colocadas: 3, total: 3, noColocadas: [],
};

const leerCot = (page) => page.evaluate((clave) => {
  try { return JSON.parse(window.localStorage.getItem(clave))?.cotizacion || null; } catch (_e) { return null; }
}, CLAVE);

async function mockSolver(page, body, counter) {
  await page.route('**/functions/v1/acomodar-espacio-recovery', async (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    counter.n += 1;
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
  });
}

async function loginYSemilla(page) {
  await page.addInitScript(([clave, estado]) => {
    try { if (!window.localStorage.getItem(clave)) window.localStorage.setItem(clave, JSON.stringify(estado)); } catch (_e) { /* modo privado */ }
  }, [CLAVE, SEMILLA]);
  await page.goto('/');
  await page.fill('#email-login', EMAIL);
  await page.fill('#pass-login', PASS);
  await page.getByRole('button', { name: /^Entrar$/i }).click();
  await expect(page.getByRole('button', { name: /Salir/i })).toBeVisible({ timeout: 20000 });
  // DIAGNÓSTICO (audit H): el fixture debe sobrevivir la hidratación.
  const cot = await leerCot(page);
  expect(cot?.partidas?.length, 'las partidas del fixture deben sobrevivir el login').toBe(2);
  expect(cot?.acomodo?.areasM?.length, 'las areasM del fixture deben sobrevivir el login').toBe(2);
}

async function irAAcomodo(page) {
  await page.getByTestId('home-cotizar').click();
  await page.getByTestId('voni-paso-muebles').click();
  const stepAcomodo = page.getByTestId('voni-paso-acomodo');
  await expect(stepAcomodo).toBeEnabled({ timeout: 15000 });
  await stepAcomodo.click();
}

test.describe('E2E P0.2 · acomodo verify-first (navegador real)', () => {
  test.skip(!hayCreds, 'Define TEST_EMAIL y TEST_PASSWORD para correr el gate E2E real.');

  test('cadena completa con edge válido → persiste PASS + hashes', async ({ page }) => {
    const pageErrors = []; page.on('pageerror', (e) => pageErrors.push(String(e?.message || e)));
    const c = { n: 0 };
    await mockSolver(page, planBueno, c);
    await loginYSemilla(page);
    await irAAcomodo(page);

    await expect.poll(() => c.n, { timeout: 30000 }).toBeGreaterThanOrEqual(1);   // el solver se invocó por la puerta única
    // Hashes sellados por el bloque D (program_hash canónico pc_, floor_hash f_).
    await expect.poll(async () => (await leerCot(page))?.acomodo?.plan?.program_hash || '', { timeout: 15000 }).toMatch(/^pc_/);
    const cot = await leerCot(page);
    expect(cot.acomodo.plan.floor_hash).toMatch(/^f_/);
    expect(cot.acomodo.plan.colocacion.length).toBe(3);
    // Autoridad del agregador: plan válido → persiste como validado.
    await expect.poll(async () => (await leerCot(page))?.acomodo?.layoutEspacialValidado, { timeout: 10000 }).toBe(true);
    expect(cot.acomodo.layoutEstado).toBe('PASS');
    expect(pageErrors, pageErrors.join('\n')).toHaveLength(0);
  });

  test('edge MENTIROSO (PASS + overlap) → el cliente lo baja y NO persiste válido', async ({ page }) => {
    const c = { n: 0 };
    await mockSolver(page, planMentiroso, c);
    await loginYSemilla(page);
    await irAAcomodo(page);

    await expect.poll(() => c.n, { timeout: 30000 }).toBeGreaterThanOrEqual(1);
    // El plan se coloca, pero el agregador detecta OVERLAP → NO validado.
    await expect.poll(async () => (await leerCot(page))?.acomodo?.plan?.program_hash || '', { timeout: 15000 }).toMatch(/^pc_/);
    await expect.poll(async () => (await leerCot(page))?.acomodo?.layoutEspacialValidado, { timeout: 10000 }).toBe(false);
    const cot = await leerCot(page);
    expect(cot.acomodo.layoutEstado).not.toBe('PASS');   // jamás PASS con overlap
    expect(cot.acomodo.layoutValidado).not.toBe(true);
  });
});
