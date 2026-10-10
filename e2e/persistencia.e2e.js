// ============================================================================
//  BLOQUE 1 · PERSISTENCIA — criterio de aprobación de Rodrigo (2026-10-10):
//   Recargar 100 veces → una sola cotización
//   Guardar simultáneamente → sin duplicados ni pérdida silenciosa
//   Vendedor edita → costos internos intactos
//   Dirección reabre → toda la economía original disponible
//   Cambiar de computadora → recuperar la cotización correcta
//   Fallo de internet → aviso claro y recuperación comprobada
//   Respaldo local → archivo exportado y restauración verificada
//  Navegador real (Chromium) + nube falsa con la semántica del servidor (ver
//  nubeFalsa.js). No toca producción.
// ============================================================================
import { test, expect } from '@playwright/test';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { crearNubeFalsa, estadoLocal, CLAVE_LOCAL } from './nubeFalsa.js';

const USUARIOS = { 'ventas@vh.mx': 'vendedor', 'ventas2@vh.mx': 'vendedor', 'rodrigo@vh.mx': 'direccion', 'diseno@vh.mx': 'diseno' };
const PASS = 'prueba-123';
const PARTIDA_SIN_ECONOMIA = { id: 'p1', nombre: 'Banca APP LT 6 usuarios', cantidad: 1, precioUnitario: 48000 };
const PARTIDA_CON_ECONOMIA = { ...PARTIDA_SIN_ECONOMIA, costoUnitario: 21000, margen: 30, costoDerivado: false };

async function sembrarLocal(context, estado) {
  await context.addInitScript(({ k, v }) => { if (!localStorage.getItem('__sembrado__')) { localStorage.setItem(k, JSON.stringify(v)); localStorage.setItem('__sembrado__', '1'); } }, { k: CLAVE_LOCAL, v: estado });
}
async function entrar(page, email) {
  await page.goto('/');
  await page.fill('#email-login', email);
  await page.fill('#pass-login', PASS);
  await page.getByRole('button', { name: /^Entrar$/i }).click();
  await expect(page.getByRole('button', { name: /Salir/i }).first()).toBeVisible({ timeout: 20000 });
  if (await page.getByRole('dialog', { name: /Guía de uso/i }).isVisible().catch(() => false)) await page.keyboard.press('Escape');
}
const estadoNube = (page) => page.getByTestId('nube-estado');
const leerLocal = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '{}'), CLAVE_LOCAL);
async function irACotizacion(page) {
  await page.getByRole('button', { name: /Mi cotización/i }).first().click();
  await expect(inputCliente(page)).toBeVisible({ timeout: 10000 });
}
const inputCliente = (page) => page.locator('label.etiqueta', { hasText: /^Cliente$/ }).locator('xpath=following-sibling::input[1]');
async function irAArchivo(page) {
  await page.getByRole('button', { name: /Presupuestos que ya hicimos/i }).first().click();
  await expect(page.getByTestId('respaldo-local')).toBeVisible({ timeout: 10000 });
}
async function abrirPrimeraDelArchivo(page) {
  await irAArchivo(page);
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: /^Abrir$/ }).first().click();
  await expect(inputCliente(page)).toBeVisible({ timeout: 10000 });
}
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const esperarGuardado = async (nube, cond, ms = 8000) => expect.poll(() => cond(nube), { timeout: ms }).toBe(true);

test.describe('Bloque 1 · persistencia certificable', () => {
  test('recargar 100 veces deja UNA sola cotización en la nube', async ({ browser }) => {
    test.setTimeout(10 * 60_000);
    const nube = crearNubeFalsa({ usuarios: USUARIOS });
    const context = await browser.newContext();
    await nube.instalar(context);
    await sembrarLocal(context, estadoLocal({ cotizacion: { cliente: 'Tradeco', partidas: [PARTIDA_SIN_ECONOMIA] } }));
    const page = await context.newPage();
    await entrar(page, 'ventas@vh.mx');
    await esperarGuardado(nube, (n) => n.filas.size === 1);
    const id = [...nube.filas.keys()][0];
    await expect.poll(async () => (await leerLocal(page)).cotizacion?.id).toBe(id);   // el id quedó PERSISTIDO
    for (let i = 0; i < 100; i++) {
      await page.reload();
      await expect(page.getByRole('button', { name: /Salir/i }).first()).toBeVisible({ timeout: 20000 });
      await esperar(1700);   // ventana del autosave
      expect(nube.filas.size, `recarga ${i + 1}`).toBe(1);
    }
    expect(nube.creates).toBe(1);
    expect(nube.filas.size).toBe(1);
    expect([...nube.filas.keys()][0]).toBe(id);
    await context.close();
  });

  test('guardar simultáneamente desde dos pestañas: sin duplicados ni pérdida silenciosa', async ({ browser }) => {
    const nube = crearNubeFalsa({ usuarios: USUARIOS });
    const context = await browser.newContext();
    await nube.instalar(context);
    await sembrarLocal(context, estadoLocal({ cotizacion: { cliente: 'Alpura', partidas: [PARTIDA_SIN_ECONOMIA] } }));
    const a = await context.newPage();
    await entrar(a, 'ventas@vh.mx');
    const b = await context.newPage();
    await b.goto('/');   // misma sesión (localStorage compartido): arranca y autosalva a la vez
    await expect(b.getByRole('button', { name: /Salir/i }).first()).toBeVisible({ timeout: 20000 });
    await esperar(2500);
    expect(nube.filas.size).toBe(1);
    // Ediciones cruzadas: ninguna crea otra fila y la última queda registrada.
    await irACotizacion(a); await inputCliente(a).fill('Alpura Norte');
    await irACotizacion(b); await inputCliente(b).fill('Alpura Sur');
    await esperarGuardado(nube, (n) => [...n.filas.values()][0].cliente === 'Alpura Sur' || [...n.filas.values()][0].cliente === 'Alpura Norte');
    await esperar(2000);
    expect(nube.filas.size).toBe(1);
    expect(nube.creates).toBe(1);
    expect(['Alpura Norte', 'Alpura Sur']).toContain([...nube.filas.values()][0].cliente);
    await context.close();
  });

  test('vendedor abre, edita y guarda → los costos internos de Dirección quedan intactos; Dirección reabre y los ve', async ({ browser }) => {
    const nube = crearNubeFalsa({ usuarios: USUARIOS });
    // Dirección ya dejó costos en la cotización del vendedor.
    const id = nube.sembrarFila({ usuario: 'ventas@vh.mx', cliente: 'Tradeco', partidas: [PARTIDA_CON_ECONOMIA], total: 55680, piezas: 1 });

    // --- el vendedor, en su computadora ---
    const cv = await browser.newContext(); await nube.instalar(cv);
    await sembrarLocal(cv, estadoLocal());
    const v = await cv.newPage();
    await entrar(v, 'ventas@vh.mx');
    await abrirPrimeraDelArchivo(v);
    // Lo que llegó a su navegador NO trae economía.
    const localV = await leerLocal(v);
    expect(localV.cotizacion.id).toBe(id);
    expect(localV.cotizacion.partidas[0]).not.toHaveProperty('costoUnitario');
    const updatesAntes = nube.updates;
    await esperar(2000);
    expect(nube.updates, 'reabrir sin editar NO escribe').toBe(updatesAntes);
    // Edita y guarda.
    await inputCliente(v).fill('Tradeco Monterrey');
    await esperarGuardado(nube, (n) => n.filas.get(id).cliente === 'Tradeco Monterrey');
    const fila = nube.filas.get(id);
    expect(fila.partidas[0].costoUnitario).toBe(21000);   // INTACTO
    expect(fila.partidas[0].margen).toBe(30);
    expect(fila.partidas[0].costoDerivado).toBe(false);
    expect(nube.filas.size).toBe(1);
    await cv.close();

    // --- Dirección reabre en la suya ---
    const cd = await browser.newContext(); await nube.instalar(cd);
    await sembrarLocal(cd, estadoLocal());
    const d = await cd.newPage();
    await entrar(d, 'rodrigo@vh.mx');
    await abrirPrimeraDelArchivo(d);
    const localD = await leerLocal(d);
    expect(localD.cotizacion.id).toBe(id);
    expect(localD.cotizacion.cliente).toBe('Tradeco Monterrey');
    expect(localD.cotizacion.partidas[0].costoUnitario).toBe(21000);
    expect(localD.cotizacion.partidas[0].margen).toBe(30);
    await cd.close();
  });

  test('cambiar de computadora recupera LA MISMA cotización; cambiar de usuario en la misma no pisa la ajena', async ({ browser }) => {
    const nube = crearNubeFalsa({ usuarios: USUARIOS });
    // Computadora 1: vendedor crea.
    const c1 = await browser.newContext(); await nube.instalar(c1);
    await sembrarLocal(c1, estadoLocal({ cotizacion: { cliente: 'Bimbo', partidas: [PARTIDA_SIN_ECONOMIA] } }));
    const p1 = await c1.newPage();
    await entrar(p1, 'ventas@vh.mx');
    await esperarGuardado(nube, (n) => n.filas.size === 1);
    const id = [...nube.filas.keys()][0];

    // Computadora 2: mismo vendedor, navegador limpio → la abre del Archivo y edita.
    const c2 = await browser.newContext(); await nube.instalar(c2);
    await sembrarLocal(c2, estadoLocal());
    const p2 = await c2.newPage();
    await entrar(p2, 'ventas@vh.mx');
    await abrirPrimeraDelArchivo(p2);
    await inputCliente(p2).fill('Bimbo Planta Norte');
    await esperarGuardado(nube, (n) => n.filas.get(id)?.cliente === 'Bimbo Planta Norte');
    expect(nube.filas.size).toBe(1);
    expect(nube.creates).toBe(1);
    await c2.close();

    // Computadora 1: sale el vendedor y entra OTRO vendedor con la cotización ajena aún en el navegador.
    await p1.getByRole('button', { name: /Salir/i }).first().click();
    await expect(p1.locator('#email-login')).toBeVisible({ timeout: 10000 });
    await p1.fill('#email-login', 'ventas2@vh.mx'); await p1.fill('#pass-login', PASS);
    await p1.getByRole('button', { name: /^Entrar$/i }).click();
    await expect(p1.getByRole('button', { name: /Salir/i }).first()).toBeVisible({ timeout: 20000 });
    await esperarGuardado(nube, (n) => n.filas.size === 2, 15000);
    const ajena = nube.filas.get(id);
    expect(ajena.usuario).toBe('ventas@vh.mx');
    expect(ajena.cliente).toBe('Bimbo Planta Norte');   // la de ventas NO se tocó
    const propia = [...nube.filas.values()].find((c) => c.id !== id);
    expect(propia.usuario).toBe('ventas2@vh.mx');
    await expect.poll(async () => (await leerLocal(p1)).cotizacion?.id).toBe(propia.id);
    await c1.close();
  });

  test('fallo de internet: aviso claro, nada se pierde y al volver se guarda', async ({ browser }) => {
    const nube = crearNubeFalsa({ usuarios: USUARIOS });
    const context = await browser.newContext(); await nube.instalar(context);
    await sembrarLocal(context, estadoLocal({ cotizacion: { cliente: 'Lala', partidas: [PARTIDA_SIN_ECONOMIA] } }));
    const page = await context.newPage();
    await entrar(page, 'ventas@vh.mx');
    await esperarGuardado(nube, (n) => n.filas.size === 1);
    const id = [...nube.filas.keys()][0];
    await irACotizacion(page);

    nube.caida = true;
    await inputCliente(page).fill('Lala Torreón');
    await expect(page.locator('.toast')).toContainText(/No se pudo guardar la cotización en la nube/i, { timeout: 10000 });
    await expect(estadoNube(page)).toHaveAttribute('data-estado', 'sin-conexion');
    expect(nube.filas.get(id).cliente).toBe('Lala');                  // la nube no lo tiene…
    expect((await leerLocal(page)).cotizacion.cliente).toBe('Lala Torreón'); // …pero la computadora sí

    nube.caida = false;
    await inputCliente(page).fill('Lala Torreón Planta 2');
    await esperarGuardado(nube, (n) => n.filas.get(id).cliente === 'Lala Torreón Planta 2');
    await expect(estadoNube(page)).toHaveAttribute('data-estado', 'conectado');
    await expect(page.locator('.toast')).toContainText(/Conexión recuperada/i, { timeout: 10000 });
    expect(nube.filas.size).toBe(1);
    await context.close();
  });

  test('respaldo local: se exporta desde la app y se restaura en otra computadora sobre LA MISMA cotización', async ({ browser }) => {
    const nube = crearNubeFalsa({ usuarios: USUARIOS });
    const c1 = await browser.newContext({ acceptDownloads: true }); await nube.instalar(c1);
    await sembrarLocal(c1, estadoLocal({ cotizacion: { cliente: 'Oxxo', folio: 'OX-9', partidas: [PARTIDA_SIN_ECONOMIA, { id: 'p2', nombre: 'Silla operativa', cantidad: 6, precioUnitario: 3200 }] } }));
    const p1 = await c1.newPage();
    await entrar(p1, 'ventas@vh.mx');
    await esperarGuardado(nube, (n) => n.filas.size === 1);
    const id = [...nube.filas.keys()][0];
    await expect.poll(async () => (await leerLocal(p1)).cotizacion?.id).toBe(id);

    await irAArchivo(p1);
    const [descarga] = await Promise.all([p1.waitForEvent('download'), p1.getByRole('button', { name: /Descargar respaldo/i }).click()]);
    // ⚠️ Ruta ASCII a propósito: Playwright NO entrega al navegador un archivo cuya ruta
    // lleva acentos (el nombre de la carpeta de resultados lleva el título de la prueba),
    // y el <input type=file> nunca dispara `change`. Medido 2026-10-10.
    const ruta = join(mkdtempSync(join(tmpdir(), 'respaldo-e2e-')), 'respaldo.json');
    await descarga.saveAs(ruta);
    const r = JSON.parse(readFileSync(ruta, 'utf8'));
    expect(r.version).toBe('respaldo-vh-1');
    expect(r.incluyeEconomia).toBe(false);
    expect(r.cotizacion.id).toBe(id);
    expect(r.cotizacion.partidas).toHaveLength(2);
    expect(r).not.toHaveProperty('insumos');
    await expect(p1.getByTestId('respaldo-msg')).toContainText(/Respaldo descargado: 2 renglón/);
    await c1.close();

    // Otra computadora, navegador vacío: restaura el archivo.
    const c2 = await browser.newContext(); await nube.instalar(c2);
    await sembrarLocal(c2, estadoLocal());
    const p2 = await c2.newPage();
    await entrar(p2, 'ventas@vh.mx');
    await irAArchivo(p2);
    p2.on('dialog', (d) => d.accept());
    await p2.getByTestId('respaldo-archivo').setInputFiles(ruta);
    await expect(inputCliente(p2)).toBeVisible({ timeout: 10000 });
    await expect(inputCliente(p2)).toHaveValue('Oxxo');
    const local2 = await leerLocal(p2);
    expect(local2.cotizacion.id).toBe(id);
    expect(local2.cotizacion.partidas).toHaveLength(2);
    const updates = nube.updates;
    await esperar(2000);
    expect(nube.updates, 'restaurar sin editar NO escribe').toBe(updates);
    await inputCliente(p2).fill('Oxxo Centro');
    await esperarGuardado(nube, (n) => n.filas.get(id)?.cliente === 'Oxxo Centro');
    expect(nube.filas.size).toBe(1);   // misma cotización, no otra
    await c2.close();
  });
});
