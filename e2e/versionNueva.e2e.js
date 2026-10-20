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
  await expect(page.getByRole('button', { name: /Salir/i }).first()).toBeVisible({ timeout: 45000 });
  if (await page.getByRole('dialog', { name: /Guía de uso/i }).isVisible().catch(() => false)) await page.keyboard.press('Escape');
}
const abrirCotizar = (page) => page.getByTestId('home-cotizar').click();
const pantallaCotizar = (page) => page.getByTestId('voni-paso-muebles');

async function arrancar(browser, { estado = estadoLocal() } = {}) {
  const nube = crearNubeFalsa({ usuarios: USUARIOS });
  const context = await browser.newContext();
  await nube.instalar(context);
  // Guía ya vista: es otra pantalla diferida y en CI aparece tarde, encima del botón de Cotizar.
  await context.addInitScript(({ k, v }) => { if (!localStorage.getItem('__sembrado__')) { localStorage.setItem(k, JSON.stringify(v)); localStorage.setItem('__sembrado__', '1'); } },
    { k: CLAVE_LOCAL, v: estado });
  const page = await context.newPage();
  await entrar(page);
  return { context, page, nube };
}

// ---- Borrador que sobrevive la recarga por versión (auditoría externa 2026-10-19) ----
const PARTIDA = { id: 'p1', nombre: 'Banca APP LT 6 usuarios', cantidad: 1, precioUnitario: 48000 };
const CLIENTE = 'Borrador Versión SA';
const PEDIDO = 'Agrega 2 escritorios de 1.50 y una credenza';
const leerLocal = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '{}'), CLAVE_LOCAL);
const inputCliente = (page) => page.locator('label.etiqueta', { hasText: /^Cliente$/ }).locator('xpath=following-sibling::input[1]');
const contarRecargas = (page) => { const n = { v: 0 }; page.on('framenavigated', (f) => { if (f === page.mainFrame()) n.v += 1; }); return n; };
// La persona deja trabajo SIN terminar: cambia el cliente de la cotización y escribe un pedido a Voni sin mandarlo.
async function dejarBorrador(page, nube) {
  await expect.poll(() => nube.filas.size, { timeout: 10000 }).toBe(1);
  await page.getByRole('button', { name: /Mi cotización/i }).first().click();
  await inputCliente(page).fill(CLIENTE);
  await page.getByRole('button', { name: /^Inicio$/ }).first().click();
  await page.getByText('Más herramientas').click();
  await page.getByRole('button', { name: /^Cotizar varios con IA/ }).click();
  await page.locator('textarea.ia-textarea').first().fill(PEDIDO);
  await page.getByRole('button', { name: /^Inicio$/ }).first().click();
  await expect(page.getByTestId('home-cotizar')).toBeVisible();
  expect((await leerLocal(page)).cotizacion.cliente).toBe(CLIENTE);
}
// Tras volver: la cotización (local y la MISMA fila en la nube) y el pedido siguen ahí.
async function borradorIntacto(page, nube, id) {
  expect((await leerLocal(page)).cotizacion.cliente).toBe(CLIENTE);
  expect((await leerLocal(page)).cotizacion.id).toBe(id);
  await expect.poll(() => nube.filas.get(id)?.cliente, { timeout: 10000 }).toBe(CLIENTE);
  expect(nube.filas.size, 'sin cotización duplicada').toBe(1);
  if (!(await pantallaCotizar(page).isVisible().catch(() => false))) await abrirCotizar(page);
  await pantallaCotizar(page).click();
  await expect(page.locator('textarea.ia-textarea').first()).toHaveValue(PEDIDO);
  await page.getByRole('button', { name: /^Inicio$/ }).first().click();
  await page.getByRole('button', { name: /Mi cotización/i }).first().click();
  await expect(inputCliente(page)).toHaveValue(CLIENTE);
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
    await expect(page.getByRole('button', { name: /Salir/i }).first()).toBeVisible({ timeout: 45000 });
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

  test('con trabajo sin terminar: archivo de otra versión → UNA recarga, la cotización y el pedido reaparecen, sin bucle', async ({ browser }) => {
    test.setTimeout(120_000);
    const { context, page, nube } = await arrancar(browser, { estado: estadoLocal({ cotizacion: { cliente: 'Original SA', partidas: [PARTIDA] } }) });
    await dejarBorrador(page, nube);
    const id = (await leerLocal(page)).cotizacion.id;
    expect(id).toBeTruthy();
    let negados = 0;
    await page.route(ARCHIVO_PANTALLA, (route) => {
      if (negados === 0) { negados += 1; return route.fulfill({ status: 404, contentType: 'text/plain', body: 'The page could not be found' }); }
      return route.continue();
    });
    const recargas = contarRecargas(page);
    await abrirCotizar(page);
    await expect.poll(() => recargas.v, { timeout: 20000 }).toBe(1);
    await expect(page.getByRole('button', { name: /Salir/i }).first()).toBeVisible({ timeout: 45000 });
    await expect(page.getByText('Esta pantalla se atoró')).toHaveCount(0);
    await expect(page.getByTestId('aviso-error-tardio')).toHaveCount(0);   // la recarga por versión no es un "error de botón"
    await borradorIntacto(page, nube, id);
    await page.waitForTimeout(3000);
    expect(recargas.v, 'una sola recarga: sin bucle').toBe(1);
    expect(negados).toBe(1);
    await context.close();
  });

  test('si no se puede recuperar sola: mensaje claro, el trabajo sigue en la computadora y "Recargar ahora" lo recupera', async ({ browser }) => {
    test.setTimeout(120_000);
    const { context, page, nube } = await arrancar(browser, { estado: estadoLocal({ cotizacion: { cliente: 'Original SA', partidas: [PARTIDA] } }) });
    await dejarBorrador(page, nube);
    const id = (await leerLocal(page)).cotizacion.id;
    // Ya se recargó hace un momento por lo mismo (candado): la app no vuelve a recargar sola.
    await page.evaluate(() => sessionStorage.setItem('vh:recargaPorVersion', String(Date.now())));
    const negar = (route) => route.fulfill({ status: 404, contentType: 'text/plain', body: 'The page could not be found' });
    await page.route(ARCHIVO_PANTALLA, negar);
    const recargas = contarRecargas(page);
    await abrirCotizar(page);
    const tarjeta = page.getByTestId('version-nueva');
    await expect(tarjeta).toBeVisible({ timeout: 15000 });
    await expect(tarjeta).toContainText('Hay una versión nueva de la app');
    await expect(tarjeta).toContainText('lo que ya está guardado no se pierde');
    await expect(tarjeta).not.toContainText(/dynamically imported|Failed to fetch|chunk/i);   // sin jerga
    await expect(page.getByText('Esta pantalla se atoró')).toHaveCount(0);
    await expect(page.getByTestId('aviso-error-tardio')).toHaveCount(0);                  // un solo mensaje, no dos
    await page.waitForTimeout(3000);
    expect(recargas.v, 'no recarga sola: sin bucle').toBe(0);
    expect((await leerLocal(page)).cotizacion.cliente).toBe(CLIENTE);                     // nada se perdió mientras tanto
    // El deploy ya está completo (el archivo existe): "Recargar ahora" trae la versión buena y el trabajo sigue.
    await page.unroute(ARCHIVO_PANTALLA, negar);
    await page.getByRole('button', { name: 'Recargar ahora' }).click();
    await expect.poll(() => recargas.v, { timeout: 20000 }).toBe(1);
    await expect(page.getByRole('button', { name: /Salir/i }).first()).toBeVisible({ timeout: 45000 });
    await borradorIntacto(page, nube, id);
    await context.close();
  });

  // Defecto encontrado el 2026-10-19 (auditoría de botones/red): SIN internet, abrir una pantalla que aún no se había
  // descargado da el MISMO error que una versión vieja ("Failed to fetch dynamically imported module") y la app se
  // recargaba… a la página de error del navegador: la app desaparecía justo cuando la cabecera decía "Sin conexión:
  // sigue en esta computadora". Ahora: se dice que es la red, el trabajo sigue y al volver la red se recarga UNA vez.
  test('sin internet, una pantalla que aún no se descargó NO recarga a la nada: lo dice, el trabajo sigue y al volver la red abre', async ({ browser }) => {
    test.setTimeout(120_000);
    const { context, page, nube } = await arrancar(browser, { estado: estadoLocal({ cotizacion: { cliente: 'Original SA', partidas: [PARTIDA] } }) });
    await dejarBorrador(page, nube);
    const id = (await leerLocal(page)).cotizacion.id;
    const recargas = contarRecargas(page);
    await context.setOffline(true);
    await abrirCotizar(page);   // Voni nunca se abrió en esta sesión: su archivo no está en el navegador
    const tarjeta = page.getByTestId('pantalla-sin-red');
    await expect(tarjeta).toBeVisible({ timeout: 15000 });
    await expect(tarjeta).toContainText('Sin internet no se puede abrir esta pantalla');
    await expect(tarjeta).toContainText('Tu trabajo sigue guardado en esta computadora');
    await expect(page.getByTestId('aviso-error-tardio')).toHaveCount(0);
    await page.waitForTimeout(2000);
    expect(recargas.v, 'sin red no se recarga (sería la página de error del navegador)').toBe(0);
    expect(page.url()).not.toMatch(/^chrome-error:/);
    expect(await page.evaluate(() => sessionStorage.getItem('vh:recargaPorVersion'))).toBeNull();   // el candado no se gastó
    expect((await leerLocal(page)).cotizacion.cliente).toBe(CLIENTE);
    // Vuelve la red: se recarga sola UNA vez y todo sigue.
    await context.setOffline(false);
    await expect.poll(() => recargas.v, { timeout: 20000 }).toBe(1);
    await expect(page.getByRole('button', { name: /Salir/i }).first()).toBeVisible({ timeout: 45000 });
    // La recarga la hizo la app (recargarUnaVez deja su candado), no el cliente de Vite al reconectar.
    expect(await page.evaluate(() => sessionStorage.getItem('vh:recargaPorVersion'))).toMatch(/^\d+$/);
    await borradorIntacto(page, nube, id);
    await page.waitForTimeout(2000);
    expect(recargas.v).toBe(1);
    await context.close();
  });
});
