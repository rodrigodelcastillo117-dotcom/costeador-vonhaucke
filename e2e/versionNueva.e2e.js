// ============================================================================
//  VERSIÓN NUEVA CON LA APP ABIERTA (incidente 2026-10-17, deploy e4d611a).
//  Una pestaña abierta desde antes de un deploy pide archivos de pantalla de SU versión; Vercel ya no los sirve (404)
//  y cada pantalla caía en "Esta pantalla se atoró" ("Reintentar" no servía). Aquí se reproduce con la nube falsa:
//  después de entrar, el archivo de la pantalla de Cotizar (Voni) responde 404 una vez, como tras un deploy.
// ============================================================================
import { test, expect } from '@playwright/test';
import { crearNubeFalsa, estadoLocal, CLAVE_LOCAL } from './nubeFalsa.js';

const USUARIOS = { 'rodrigo@vh.mx': 'direccion' };
// Dev: el módulo fuente; build de producción (E2E_BUILD=1, `vite preview`): el archivo con hash, como en Vercel.
const ARCHIVO_PANTALLA = process.env.E2E_BUILD ? '**/assets/Voni-*.js' : '**/src/componentes/Voni.jsx*';

async function entrar(page) {
  await page.goto('/');
  await page.fill('#email-login', 'rodrigo@vh.mx');
  await page.fill('#pass-login', 'prueba-123');
  await page.getByRole('button', { name: /^Entrar$/i }).click();
  await expect(page.getByRole('button', { name: /Salir/i }).first()).toBeVisible({ timeout: 20000 });
  if (await page.getByRole('dialog', { name: /Guía de uso/i }).isVisible().catch(() => false)) await page.keyboard.press('Escape');
}
const abrirCotizar = (page) => page.getByTestId('home-cotizar').click();
const pantallaCotizar = (page) => page.getByTestId('voni-paso-muebles');

async function arrancar(browser) {
  const nube = crearNubeFalsa({ usuarios: USUARIOS });
  const context = await browser.newContext();
  await nube.instalar(context);
  // Guía ya vista: es otra pantalla diferida y en CI aparece tarde, encima del botón de Cotizar.
  await context.addInitScript(({ k, v }) => { if (!localStorage.getItem('__sembrado__')) { localStorage.setItem(k, JSON.stringify(v)); localStorage.setItem('__sembrado__', '1'); } },
    { k: CLAVE_LOCAL, v: estadoLocal() });
  const page = await context.newPage();
  await entrar(page);
  return { context, page };
}

test.describe('Versión nueva publicada con la app abierta', () => {
  test('el archivo de pantalla de otra versión da 404: la app se recarga UNA vez sola y la pantalla abre', async ({ browser }) => {
    test.setTimeout(90_000);
    const { context, page } = await arrancar(browser);
    let negados = 0;
    await page.route(ARCHIVO_PANTALLA, (route) => {
      if (negados === 0) { negados += 1; return route.fulfill({ status: 404, contentType: 'text/plain', body: 'The page could not be found' }); }
      return route.continue();
    });
    const recarga = page.waitForEvent('framenavigated', { timeout: 20000 });
    await abrirCotizar(page);
    await recarga;
    expect(negados).toBe(1);
    await expect(page.getByRole('button', { name: /Salir/i }).first()).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('Esta pantalla se atoró')).toHaveCount(0);
    if (!(await pantallaCotizar(page).isVisible().catch(() => false))) await abrirCotizar(page);
    await expect(pantallaCotizar(page)).toBeVisible({ timeout: 15000 });
    expect(await page.evaluate(() => sessionStorage.getItem('vh:recargaPorVersion'))).toMatch(/^\d+$/);
    await context.close();
  });

  test('si ya se recargó hace un momento, no entra en bucle: muestra "Hay una versión nueva" con su botón', async ({ browser }) => {
    test.setTimeout(90_000);
    const { context, page } = await arrancar(browser);
    await page.evaluate(() => sessionStorage.setItem('vh:recargaPorVersion', String(Date.now())));
    await page.route(ARCHIVO_PANTALLA, (route) => route.fulfill({ status: 404, contentType: 'text/plain', body: 'The page could not be found' }));
    let navegaciones = 0;
    page.on('framenavigated', (f) => { if (f === page.mainFrame()) navegaciones += 1; });
    await abrirCotizar(page);
    await expect(page.getByTestId('version-nueva')).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: 'Recargar ahora' })).toBeVisible();
    await page.waitForTimeout(3000);
    expect(navegaciones).toBe(0);
    await context.close();
  });
});
