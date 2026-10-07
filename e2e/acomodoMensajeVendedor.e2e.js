import { test, expect } from '@playwright/test';

// ============================================================================
//  E2E P0.2b (G) — MENSAJE AL VENDEDOR en navegador real, flujo NORMAL (sin modo
//  manual). Edge recovery MOCKEADO con un resultado PARTIAL que trae
//  `mensaje_vendedor`. Se verifica que el vendedor ve, SIEMPRE visible:
//   · la lista de lo que NO cupó,
//   · el motivo causal,
//   · la(s) opción(es) concreta(s).
//  Harness idéntico al gate acomodoP02 (semilla coherente + mock del edge).
//  Evidencia: probado con mock (el edge nuevo aún no está desplegado).
//  Único skip permitido: ausencia de credenciales.
// ============================================================================
const EMAIL = process.env.TEST_EMAIL;
const PASS = process.env.TEST_PASSWORD;
const hayCreds = !!(EMAIL && PASS);
const CLAVE = 'costeador-vonhaucke-v1';

// Semilla COHERENTE (idéntica a acomodoP02): bench + 2 sillas + mesa, 2 áreas.
const SEMILLA = {
  onboardingVisto: true,
  cotizacion: {
    partidas: [
      { id: 'b', piezaId: 'op-bench', nombre: 'Bench operativo App LT', cantidad: 1, w: 6000, d: 1200, precioUnitario: 28540 },
      { id: 'w', piezaId: 'silla-win', nombre: 'Silla operativa WIN', cantidad: 2, precioUnitario: 5210 },
      { id: 'm', piezaId: 'mj-2400x1200', nombre: 'Mesa de juntas', cantidad: 1, w: 2400, d: 1200, precioUnitario: 5510 },
    ],
    acomodo: { areasM: [
      { nombre: 'OPERATIVA', tipo: 'open', ancho: 8, largo: 4 },
      { nombre: 'JUNTAS', tipo: 'juntas', ancho: 5, largo: 4 },
    ] },
  },
};

// PARTIAL: coloca bench + 2 sillas; la mesa (m-1) NO cupo. Trae mensaje_vendedor.
const planParcial = {
  ok: true,
  plan: {
    colocacion: [
      { id: 'b-1', area: 0, x: 0, y: 0, rot: 0 },
      { id: 'w-1', area: 0, x: 0, y: 1500, rot: 0 },
      { id: 'w-2', area: 0, x: 2000, y: 1500, rot: 0 },
    ],
    piezas: [
      { id: 'b-1', relation_role: 'ANCHOR_WORKSTATION', functional_group_id: 'gop', zone_id: 'OPERATIVA', w: 6000, d: 1200, anchor_instance_id: null },
      { id: 'w-1', relation_role: 'WORK_SEAT', functional_group_id: 'gop', zone_id: 'OPERATIVA', w: 600, d: 600, anchor_instance_id: 'b-1' },
      { id: 'w-2', relation_role: 'WORK_SEAT', functional_group_id: 'gop', zone_id: 'OPERATIVA', w: 600, d: 600, anchor_instance_id: 'b-1' },
      { id: 'm-1', relation_role: 'ANCHOR_MEETING', functional_group_id: 'gjt', zone_id: 'JUNTAS', w: 2400, d: 1200, anchor_instance_id: null },
    ],
  },
  layoutSpec: {
    version: 'PLACEMENT_SPEC_V2_RECOVERY', status: 'PARTIAL', requested: 4, placed: 3, unplaced: ['m-1'],
    validation: { render_ready: false, invariant_ok: false },
  },
  render_ready: false, strictPlacement: true, status: 'PARTIAL', completo: false, colocadas: 3, total: 4,
  no_cupieron: [{ anchorId: 'm-1', piezas: ['m-1'], invariante: 'NO_SPACE' }],
  unassigned: [],
  mensaje_vendedor: {
    pendientes: [{ rol: 'ANCHOR_MEETING', n: 1, texto: '1 mesa de juntas' }],
    motivos: [{ invariante: 'NO_SPACE', texto: 'El grupo necesita ~12.0 m² y el área "JUNTAS" tiene ~20.0 m².' }],
    opciones: [{ id: 'mesa_mas_chica', texto: 'Cambiar la mesa de 2.40 m por una de 1.44 m: cabe con sus sillas.' }],
    sin_opcion: null, hay_pendientes: true,
  },
};

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
}

async function irAAcomodo(page) {
  await page.getByTestId('home-cotizar').click();
  await page.getByTestId('voni-paso-muebles').click();
  const stepAcomodo = page.getByTestId('voni-paso-acomodo');
  await expect(stepAcomodo).toBeEnabled({ timeout: 15000 });
  await stepAcomodo.click();
}

test.describe('E2E P0.2b · G mensaje al vendedor (flujo normal, mock)', () => {
  test.skip(!hayCreds, 'Define TEST_EMAIL y TEST_PASSWORD para correr el gate E2E real.');

  test('PARTIAL en flujo normal → el vendedor ve QUÉ no cupó, POR QUÉ y QUÉ hacer', async ({ page }) => {
    const c = { n: 0 };
    await mockSolver(page, planParcial, c);
    await loginYSemilla(page);
    await irAAcomodo(page);

    // Forzar el acomodo por la puerta normal (botón visible, sin modo manual).
    const btn = page.getByTestId('acomodo-acomodar');
    if (await btn.isVisible().catch(() => false)) await btn.click();
    await expect.poll(() => c.n, { timeout: 30000 }).toBeGreaterThanOrEqual(1);   // el edge (mock) se invocó

    // La tarjeta del vendedor es SIEMPRE visible cuando hay pendientes.
    await expect(page.getByText(/No cupo:/)).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(/1 mesa de juntas/)).toBeVisible();
    await expect(page.getByText(/necesita ~12\.0 m²/)).toBeVisible();              // motivo causal
    await expect(page.getByText(/Cambiar la mesa de 2\.40 m/)).toBeVisible();      // opción concreta verificada
    await page.screenshot({ path: 'test-results/mensaje-vendedor.png', fullPage: true });
  });
});
