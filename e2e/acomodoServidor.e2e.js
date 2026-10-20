// ============================================================================
//  VH-067 · El acomodo "Con IA" se lee por el veredicto del servidor
//  (layoutSpec.status), no por su `ok: true` fijo. FAIL = error con motivo;
//  PARTIAL = plan usable que dice qué faltó.
// ============================================================================
import { test, expect } from '@playwright/test';
import { crearNubeFalsa, estadoLocal, CLAVE_LOCAL } from './nubeFalsa.js';

const USUARIOS = { 'rodrigo@vh.mx': 'direccion' };
// Programa COHERENTE (bench ancla + sillas + mesa): el cliente vivo NO acomoda un programa
// comercial incompleto (validarCoherenciaPrograma), así que el escenario lo respeta.
const PARTIDAS = [
  { id: 'b', piezaId: 'op-bench', nombre: 'Bench operativo App LT', cantidad: 1, w: 6000, d: 1200, precioUnitario: 28540 },
  { id: 'w', piezaId: 'silla-win', nombre: 'Silla operativa WIN', cantidad: 2, precioUnitario: 5210 },
  { id: 'm', piezaId: 'mj-2400x1200', nombre: 'Mesa de juntas', cantidad: 1, w: 2400, d: 1200, precioUnitario: 5510 },
];
const ACOMODO = { areasM: [
  { nombre: 'OPERATIVA', tipo: 'open', ancho: 8, largo: 4, puertas: [{ x: 0.2, y: 0, ancho: 0.9 }] },
  { nombre: 'JUNTAS', tipo: 'juntas', ancho: 5, largo: 4 },
], planReal: true, plan: null };

async function abrirAcomodo(browser, nube) {
  const context = await browser.newContext(); await nube.instalar(context);
  await context.addInitScript(({ k, v }) => { if (!localStorage.getItem('__s')) { localStorage.setItem(k, JSON.stringify(v)); localStorage.setItem('__s', '1'); } },
    { k: CLAVE_LOCAL, v: estadoLocal({ cotizacion: { partidas: PARTIDAS, acomodo: ACOMODO } }) });
  const page = await context.newPage();
  await page.goto('/');
  await page.fill('#email-login', 'rodrigo@vh.mx'); await page.fill('#pass-login', 'prueba-123');
  await page.getByRole('button', { name: /^Entrar$/i }).click();
  await expect(page.getByRole('button', { name: /Salir/i }).first()).toBeVisible({ timeout: 45000 });
  if (await page.getByRole('dialog', { name: /Guía de uso/i }).isVisible().catch(() => false)) await page.keyboard.press('Escape');
  await page.getByText('Más herramientas').click();   // inicio vivo: tres tarjetas + atajos plegados
  await page.getByRole('button', { name: /^Acomodo\b/ }).click();
  const conIA = page.getByRole('button', { name: /^Con IA$/ });
  await expect(conIA).toBeVisible({ timeout: 15000 });
  await conIA.click();
  return { context, page };
}

test('FAIL del servidor (con ok:true): se dice el motivo y no se toma como acomodo', async ({ browser }) => {
  const nube = crearNubeFalsa({ usuarios: USUARIOS });
  nube.acomodoServidor = { ok: true, plan: { colocacion: [], caben: false }, total: 4, colocadas: 0, metodo: 'deterministic_first_ai_repair_v10',
    noColocadas: [{ id: 'b-1', codigos: ['OUTSIDE_ZONE'], motivo: 'no cabe dentro del cuarto' }, { id: 'w-1', codigos: ['OVERLAP'], motivo: 'encimado' }, { id: 'w-2', codigos: ['OVERLAP'], motivo: 'encimado' }, { id: 'm-1', codigos: ['NO_SPACE'], motivo: 'sin espacio' }],
    puertas: { total: 1, verificadas: false, verificadasCount: 0, noVerificadas: [{}], status: 'UNVERIFIED' },
    layoutSpec: { status: 'FAIL', validation: { issues: [{ code: 'OVERLAP', a: 'w-1', b: 'w-2' }], reviews: [] } } };
  const { context, page } = await abrirAcomodo(browser, nube);
  const err = page.locator('.alerta.roja', { hasText: /no pudo colocar ningún mueble/ });
  await expect(err).toBeVisible({ timeout: 20000 });
  // Lab 19-oct: el aviso nombra los muebles (nunca sus ids).
  await expect(err).toContainText(/Encimado entre «Silla operativa WIN» y «Silla operativa WIN»/);
  await expect(err).not.toContainText(/«w-1»|«w-2»/);
  await expect(err).toContainText(/no cabe dentro del cuarto/);
  // Fail-closed: el veredicto FAIL no se sustituye por un borrador local.
  await expect(page.locator('.alerta.roja', { hasText: /acomodo local como borrador/ })).toHaveCount(0);
  const est = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '{}'), CLAVE_LOCAL);
  expect(est.cotizacion?.acomodo?.plan?.colocacion?.length || 0).toBe(0);
  await context.close();
});

test('PARTIAL: el plan se usa, se nombra lo que faltó y el veredicto queda guardado', async ({ browser }) => {
  const nube = crearNubeFalsa({ usuarios: USUARIOS });
  nube.acomodoServidor = { ok: true, plan: { colocacion: [
      { id: 'b-1', area: 0, x: 0, y: 0, rot: 0 }, { id: 'w-1', area: 0, x: 0, y: 1500, rot: 0 }, { id: 'w-2', area: 0, x: 2000, y: 1500, rot: 0 },
    ], caben: false }, total: 4, colocadas: 3, request_id: 'req-aco-1',
    noColocadas: [{ id: 'm-1', codigos: ['NO_SPACE'], motivo: 'sin espacio' }],
    puertas: { total: 1, verificadas: true, verificadasCount: 1, noVerificadas: [], status: 'VERIFIED' },
    layoutSpec: { status: 'PARTIAL', validation: { issues: [], reviews: [] } } };
  const { context, page } = await abrirAcomodo(browser, nube);
  await expect(page.locator('.alerta.ambar', { hasText: /1 mueble\(s\) sin colocar: Mesa de juntas/ })).toBeVisible({ timeout: 20000 });
  // Lo que faltó se dice; el acomodo NO se presenta como listo para render/PDF.
  await expect(page.locator('.alerta.roja', { hasText: /parcial|Corrige antes de render/ })).toBeVisible();
  await expect.poll(async () => (await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '{}'), CLAVE_LOCAL)).cotizacion?.acomodo?.plan?.servidor?.estado, { timeout: 10000 }).toBe('PARTIAL');
  const est = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '{}'), CLAVE_LOCAL);
  expect(est.cotizacion.acomodo.plan.colocacion).toHaveLength(3);
  expect(est.cotizacion.acomodo.plan.sinColocar).toEqual(['m-1']);
  expect(est.cotizacion.acomodo.layoutEspacialValidado).not.toBe(true);
  await context.close();
});
