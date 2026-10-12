// ============================================================================
//  VH-067 · El acomodo "Con IA" se lee por el veredicto del servidor
//  (layoutSpec.status), no por su `ok: true` fijo. FAIL = error con motivo;
//  PARTIAL = plan usable que dice qué faltó.
// ============================================================================
import { test, expect } from '@playwright/test';
import { crearNubeFalsa, estadoLocal, CLAVE_LOCAL } from './nubeFalsa.js';

const USUARIOS = { 'rodrigo@vh.mx': 'direccion' };
const PARTIDA = { id: 'p1', nombre: 'Escritorio recto 1.40', cantidad: 2, precioUnitario: 9000, costoUnitario: 5000, margen: 30, costoDerivado: false, medidas: { ancho: 1400, fondo: 700 } };
const ACOMODO = { areasM: [{ nombre: 'Área operativa', tipo: 'open', ancho: 8, largo: 6, puertas: [{ x: 0.2, y: 0, ancho: 0.9 }] }], planReal: true, plan: null };

async function abrirAcomodo(browser, nube) {
  const context = await browser.newContext(); await nube.instalar(context);
  await context.addInitScript(({ k, v }) => { if (!localStorage.getItem('__s')) { localStorage.setItem(k, JSON.stringify(v)); localStorage.setItem('__s', '1'); } },
    { k: CLAVE_LOCAL, v: estadoLocal({ cotizacion: { partidas: [PARTIDA], acomodo: ACOMODO } }) });
  const page = await context.newPage();
  await page.goto('/');
  await page.fill('#email-login', 'rodrigo@vh.mx'); await page.fill('#pass-login', 'prueba-123');
  await page.getByRole('button', { name: /^Entrar$/i }).click();
  await expect(page.getByRole('button', { name: /Salir/i }).first()).toBeVisible({ timeout: 20000 });
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
  nube.acomodoServidor = { ok: true, plan: { colocacion: [], caben: false }, total: 2, colocadas: 0, metodo: 'deterministic_first_ai_repair_v10',
    noColocadas: [{ id: 'p1-1', codigos: ['OUTSIDE_ZONE'], motivo: 'no cabe dentro del cuarto' }, { id: 'p1-2', codigos: ['OVERLAP'], motivo: 'encimado' }],
    puertas: { total: 1, verificadas: false, verificadasCount: 0, noVerificadas: [{}], status: 'UNVERIFIED' },
    layoutSpec: { status: 'FAIL', validation: { issues: [{ code: 'OVERLAP', a: 'p1-1', b: 'p1-2' }], reviews: [] } } };
  const { context, page } = await abrirAcomodo(browser, nube);
  const err = page.locator('.alerta.roja', { hasText: /no pudo colocar ningún mueble/ });
  await expect(err).toBeVisible({ timeout: 15000 });
  await expect(err).toContainText(/Encimado entre «p1-1» y «p1-2»/);
  await expect(err).toContainText(/no cabe dentro del cuarto/);
  await context.close();
});

test('PARTIAL: el plan se usa, se nombra lo que faltó y el veredicto queda guardado', async ({ browser }) => {
  const nube = crearNubeFalsa({ usuarios: USUARIOS });
  nube.acomodoServidor = { ok: true, plan: { colocacion: [{ id: 'p1-1', area: 0, x: 500, y: 500, rot: 0 }], caben: false }, total: 2, colocadas: 1, request_id: 'req-aco-1',
    noColocadas: [{ id: 'p1-2', codigos: ['NO_SPACE'], motivo: 'sin espacio' }],
    puertas: { total: 1, verificadas: true, verificadasCount: 1, noVerificadas: [], status: 'VERIFIED' },
    layoutSpec: { status: 'PARTIAL', validation: { issues: [], reviews: [] } } };
  const { context, page } = await abrirAcomodo(browser, nube);
  await expect(page.locator('.alerta.ambar', { hasText: /1 mueble\(s\) sin colocar: Escritorio recto 1.40/ })).toBeVisible({ timeout: 15000 });
  await expect(page.locator('.alerta.roja')).toHaveCount(0);
  await expect.poll(async () => (await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '{}'), CLAVE_LOCAL)).cotizacion?.acomodo?.plan?.servidor?.estado, { timeout: 10000 }).toBe('PARTIAL');
  const est = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '{}'), CLAVE_LOCAL);
  expect(est.cotizacion.acomodo.plan.colocacion).toHaveLength(1);
  expect(est.cotizacion.acomodo.plan.sinColocar).toEqual(['p1-2']);
  await context.close();
});
