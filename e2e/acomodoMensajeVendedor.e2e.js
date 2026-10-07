import { test, expect } from '@playwright/test';

// ============================================================================
//  E2E P0.2b (G) — MENSAJE AL VENDEDOR en navegador real, flujo NORMAL (sin modo
//  manual). Edge recovery MOCKEADO con un resultado PARTIAL que trae
//  `mensaje_vendedor`. Se verifica que el vendedor ve, SIEMPRE visible:
//   · la lista de lo que NO cupó,
//   · el motivo causal,
//   · la(s) opción(es) concretas.
//  Evidencia: probado con mock (el edge nuevo aún no está desplegado).
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
      { id: 'b', piezaId: 'op-bench', nombre: 'Bench operativo App LT', cantidad: 1, w: 6000, d: 1200, precioUnitario: 28540 },
      { id: 'w', piezaId: 'silla-win', nombre: 'Silla operativa WIN', cantidad: 2, precioUnitario: 5210 },
    ],
    acomodo: { areasM: [{ nombre: 'OPERATIVA', tipo: 'open', ancho: 8, largo: 4 }] },
  },
};

// PARTIAL: coloca bench + 1 silla; la 2ª silla NO cupo. Trae mensaje_vendedor.
const planParcial = {
  ok: true,
  plan: {
    colocacion: [
      { id: 'b-1', area: 0, x: 0, y: 0, rot: 0 },
      { id: 'w-1', area: 0, x: 0, y: 1500, rot: 0 },
    ],
    piezas: [
      { id: 'b-1', relation_role: 'ANCHOR_WORKSTATION', functional_group_id: 'g', zone_id: 'OPERATIVA', w: 6000, d: 1200, anchor_instance_id: null },
      { id: 'w-1', relation_role: 'WORK_SEAT', functional_group_id: 'g', zone_id: 'OPERATIVA', w: 600, d: 600, anchor_instance_id: 'b-1' },
      { id: 'w-2', relation_role: 'WORK_SEAT', functional_group_id: 'g', zone_id: 'OPERATIVA', w: 600, d: 600, anchor_instance_id: 'b-1' },
    ],
  },
  layoutSpec: { version: 'PLACEMENT_SPEC_V2_RECOVERY', status: 'PARTIAL', requested: 3, placed: 2, unplaced: ['w-2'], validation: { render_ready: false, invariant_ok: false } },
  render_ready: false, strictPlacement: true, status: 'PARTIAL',
  no_cupieron: [{ anchorId: 'b-1', piezas: ['w-2'], invariante: 'NO_SPACE_PARA_SILLAS' }],
  unassigned: [],
  mensaje_vendedor: {
    pendientes: [{ rol: 'WORK_SEAT', n: 1, texto: '1 silla operativa' }],
    motivos: [{ invariante: 'NO_SPACE_PARA_SILLAS', texto: 'No quedó espacio para 1 silla junto a su mueble conservando el pasillo de 1.0 m.' }],
    opciones: [{ id: 'quitar_no_colocadas', texto: 'Quitar 1 silla operativa: el resto queda acomodado completo.' }],
    sin_opcion: null, hay_pendientes: true,
  },
};

async function mockSolver(page, body) {
  await page.route('**/functions/v1/acomodar-espacio-recovery', async (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
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
    await mockSolver(page, planParcial);
    await loginYSemilla(page);
    await irAAcomodo(page);

    // SIEMPRE visible (no hace falta entrar a modo manual).
    await expect(page.getByText('No cupo:')).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('1 silla operativa')).toBeVisible();
    await expect(page.getByText(/espacio para 1 silla/i)).toBeVisible();        // motivo causal
    await expect(page.getByText(/Quitar 1 silla operativa/i)).toBeVisible();     // opción concreta
    await page.screenshot({ path: 'test-results/mensaje-vendedor.png', fullPage: true });
  });
});
