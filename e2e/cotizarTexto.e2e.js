// ============================================================================
//  COTIZAR con IA (cotizar-texto) · el camino del vendedor es fail-closed:
//  lo que se cuesta entra con precio; lo que no existe se dice; lo que la IA
//  sugirió sin pedirlo se informa y NO se cobra (VH-070); nunca un renglón en $0.
// ============================================================================
import { test, expect } from '@playwright/test';
import { crearNubeFalsa, estadoLocal, CLAVE_LOCAL } from './nubeFalsa.js';

const USUARIOS = { 'ventas@vh.mx': 'vendedor' };

async function pedirConVoni(browser, nube) {
  const context = await browser.newContext(); await nube.instalar(context);
  await context.addInitScript(({ k, v }) => { if (!localStorage.getItem('__s')) { localStorage.setItem(k, JSON.stringify(v)); localStorage.setItem('__s', '1'); } }, { k: CLAVE_LOCAL, v: estadoLocal() });
  const page = await context.newPage();
  await page.goto('/');
  await page.fill('#email-login', 'ventas@vh.mx'); await page.fill('#pass-login', 'prueba-123');
  await page.getByRole('button', { name: /^Entrar$/i }).click();
  await expect(page.getByRole('button', { name: /Salir/i }).first()).toBeVisible({ timeout: 20000 });
  await page.getByTestId('home-cotizar').click();
  await expect(page.getByText(/Soy .*Voni/i).first()).toBeVisible({ timeout: 10000 });
  await page.getByRole('button', { name: /Empezar por los muebles/ }).click();
  const caja = page.locator('textarea.ia-textarea').first();
  await expect(caja).toBeVisible({ timeout: 10000 });
  await caja.fill('2 escritorios de 1.50, una cabina acústica y una credenza');
  await page.getByRole('button', { name: /Armar la lista de muebles/ }).click();
  return { context, page };
}

test('vendedor: entra lo costeable con precio, se dice lo que no existe y el extra descartado; nada en $0', async ({ browser }) => {
  const nube = crearNubeFalsa({ usuarios: USUARIOS });
  const { context, page } = await pedirConVoni(browser, nube);
  await expect(page.getByText(/Agregué 1 mueble/)).toBeVisible({ timeout: 20000 });
  await expect(page.getByText(/Esto no está en catálogo: Cabina acústica/)).toBeVisible();
  await expect(page.getByText(/No pude costear: Mueble fantasma/)).toBeVisible();
  await expect(page.getByText(/Sin precio autorizado .*Escritorio/)).toBeVisible();
  await expect(page.getByTestId('sugerencias-descartadas')).toContainText(/Credenza ejecutiva/);
  await expect(page.getByTestId('sugerencias-descartadas')).toContainText(/no lo agregué/);
  await expect.poll(async () => (await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '{}'), CLAVE_LOCAL)).cotizacion?.partidas?.length, { timeout: 10000 }).toBeGreaterThan(0);
  const est = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '{}'), CLAVE_LOCAL);
  const partidas = est.cotizacion.partidas;
  // Sólo la banca con precio real; ni el escritorio sin precio, ni el fantasma, ni la credenza sugerida.
  expect(partidas).toHaveLength(1);
  expect(partidas[0].nombre).toMatch(/Banca/i);
  expect(partidas.some((p) => /fantasma|credenza|escritorio/i.test(p.nombre || ''))).toBe(false);
  for (const p of partidas) {
    expect(Number(p.precioUnitario) > 0 || p.sinPrecioAutorizado === true).toBe(true);   // nunca $0 disfrazado
    expect(p.costoUnitario == null || p.costoUnitario === undefined).toBe(true);           // seller-safe
  }
  await context.close();
});

// VH-071: antes, sin agregados, Voni paso 2 no enseñaba NADA (resultado escondido en la pantalla 'formulario').
test('propuesta sin nada costeable: no se agrega ningún renglón y se explica en la misma pantalla', async ({ browser }) => {
  const nube = crearNubeFalsa({ usuarios: USUARIOS });
  nube.cotizacionIA = { ok: true, rondasAclaracion: 0, propuesta: { items: [{ ruta: 'x', producto: 'y', cantidad: 1, seleccion: [], etiqueta: 'Cosa', confianza: 'baja', nota: '' }], banco: [], preguntas: ['¿De qué línea?'], resumen: 'Entendí poco.', noEncontrado: [] } };
  const { context, page } = await pedirConVoni(browser, nube);
  await expect(page.getByText(/No pude costear: Cosa/)).toBeVisible({ timeout: 20000 });
  await expect(page.getByText(/¿De qué línea\?/)).toBeVisible();
  const est = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '{}'), CLAVE_LOCAL);
  expect(est.cotizacion?.partidas?.length || 0).toBe(0);
  await context.close();
});
