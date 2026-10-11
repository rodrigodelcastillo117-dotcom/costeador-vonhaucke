// ============================================================================
//  VH-043 · La lectura del plano se CONFIRMA antes de usarse (mandato §4), y lo
//  confirmado conserva los puestos contados (VH-002) hasta el estado guardado.
// ============================================================================
import { test, expect } from '@playwright/test';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { crearNubeFalsa, estadoLocal, CLAVE_LOCAL } from './nubeFalsa.js';

const USUARIOS = { 'ventas@vh.mx': 'vendedor' };
const PNG_1x1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

test('subir plano → confirmar lectura → paso 2, con puestos contados y lectura confirmada en el estado', async ({ browser }) => {
  const nube = crearNubeFalsa({ usuarios: USUARIOS });
  const context = await browser.newContext(); await nube.instalar(context);
  await context.addInitScript(({ k, v }) => { if (!localStorage.getItem('__s')) { localStorage.setItem(k, JSON.stringify(v)); localStorage.setItem('__s', '1'); } }, { k: CLAVE_LOCAL, v: estadoLocal() });
  const page = await context.newPage();
  await page.goto('/');
  await page.fill('#email-login', 'ventas@vh.mx'); await page.fill('#pass-login', 'prueba-123');
  await page.getByRole('button', { name: /^Entrar$/i }).click();
  await expect(page.getByRole('button', { name: /Salir/i }).first()).toBeVisible({ timeout: 20000 });
  await page.locator('button.voni-principal').click();
  await expect(page.getByText(/Soy .*Voni/i).first()).toBeVisible({ timeout: 10000 });

  // Subir un plano (la nube falsa contesta con la lectura fija).
  const ruta = join(mkdtempSync(join(tmpdir(), 'plano-e2e-')), 'plano.png');
  writeFileSync(ruta, PNG_1x1);
  await page.locator('input[type=file][accept*="pdf"]').first().setInputFiles(ruta);

  // 1) NADA se usa todavía: aparece la compuerta con lo entendido.
  const gate = page.getByTestId('confirmar-lectura');
  await expect(gate).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId('lectura-nivel')).toContainText(/4 cuarto\(s\)/);
  await expect(page.getByTestId('lectura-areas')).toContainText('Isla 1');
  await expect(gate).toContainText('8 puestos contados');
  const antes = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '{}'), CLAVE_LOCAL);
  expect(antes.cotizacion?.acomodo?.areasM?.length || 0).toBe(0);

  // 2) Confirmar: ahora sí se guarda, con puestos y sello de confirmación, y se avanza al paso 2.
  await page.getByTestId('lectura-confirmar').click();
  await expect(gate).toBeHidden();
  await expect.poll(async () => (await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '{}'), CLAVE_LOCAL)).cotizacion?.acomodo?.areasM?.length).toBe(4);
  const despues = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '{}'), CLAVE_LOCAL);
  const islas = despues.cotizacion.acomodo.areasM.filter((a) => /^Isla/.test(a.nombre));
  expect(islas.map((a) => a.puestos)).toEqual([4, 4]);           // VH-002: el conteo sobrevive
  expect(despues.cotizacion.acomodo.planReal).toBe(true);
  expect(despues.cotizacion.acomodo.lectura?.en).toBeTruthy();   // quién/cuándo confirmó
  expect(despues.cotizacion.acomodo.lectura?.cuartos).toBe(4);
  await context.close();
});

test('"Volver a subir" descarta la lectura sin tocar el estado', async ({ browser }) => {
  const nube = crearNubeFalsa({ usuarios: USUARIOS });
  const context = await browser.newContext(); await nube.instalar(context);
  await context.addInitScript(({ k, v }) => { if (!localStorage.getItem('__s')) { localStorage.setItem(k, JSON.stringify(v)); localStorage.setItem('__s', '1'); } }, { k: CLAVE_LOCAL, v: estadoLocal() });
  const page = await context.newPage();
  await page.goto('/');
  await page.fill('#email-login', 'ventas@vh.mx'); await page.fill('#pass-login', 'prueba-123');
  await page.getByRole('button', { name: /^Entrar$/i }).click();
  await expect(page.getByRole('button', { name: /Salir/i }).first()).toBeVisible({ timeout: 20000 });
  await page.locator('button.voni-principal').click();
  const ruta = join(mkdtempSync(join(tmpdir(), 'plano-e2e-')), 'plano.png');
  writeFileSync(ruta, PNG_1x1);
  await page.locator('input[type=file][accept*="pdf"]').first().setInputFiles(ruta);
  await expect(page.getByTestId('confirmar-lectura')).toBeVisible({ timeout: 15000 });
  await page.getByTestId('lectura-cancelar').click();
  await expect(page.getByTestId('confirmar-lectura')).toBeHidden();
  const local = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '{}'), CLAVE_LOCAL);
  expect(local.cotizacion?.acomodo?.areasM?.length || 0).toBe(0);
  await context.close();
});
