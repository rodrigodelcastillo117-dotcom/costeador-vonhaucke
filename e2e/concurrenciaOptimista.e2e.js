// ============================================================================
//  VH-148 · CONCURRENCIA OPTIMISTA — dos "pestañas" (dos navegadores, mismo usuario) sobre la
//  misma cotización. Criterio de Dirección (2026-10-13):
//    · la pestaña A guarda → ok;
//    · la pestaña B, con su copia vieja, intenta guardar → el servidor la RECHAZA (40001),
//      lo local de B NO se pierde, aparece el aviso y el autosave queda en pausa;
//    · "Volver a aplicar mis cambios" → B guarda encima con la versión fresca (un clic);
//    · "Ver la versión del servidor" → carga lo del servidor y respalda lo local en esta computadora.
//  Navegador real (Chromium) + nube falsa con la semántica de PROPUESTA_vh148 (ver nubeFalsa.js;
//  probada contra PostgreSQL real en supabase/tests/controlOptimista.test.js). No toca producción.
//
//  BANDERA: el dev server ya está corriendo, así que `VITE_CONTROL_OPTIMISTA` (variable de build) no
//  se puede fijar desde aquí. Por eso el cliente también la lee de localStorage
//  (`vh:controlOptimista` = '1', ver src/datos/conflictoGuardado.js) y el spec la prende con
//  addInitScript ANTES de que cargue la app. En producción la bandera se prende por build.
// ============================================================================
import { test, expect } from '@playwright/test';
import { crearNubeFalsa, estadoLocal, CLAVE_LOCAL } from './nubeFalsa.js';

const USUARIOS = { 'ventas@vh.mx': 'vendedor', 'rodrigo@vh.mx': 'direccion' };
const PASS = 'prueba-123';
const FLAG = 'vh:controlOptimista';
const PARTIDA = { id: 'p1', nombre: 'Banca APP LT 6 usuarios', cantidad: 1, precioUnitario: 48000 };

// Una "pestaña" = un contexto propio (localStorage propio, como otra computadora o un perfil aparte).
async function pestana(browser, nube, { flag = true } = {}) {
  const context = await browser.newContext();
  await nube.instalar(context);
  await context.addInitScript(({ k, v, flag, fk }) => {
    if (!localStorage.getItem('__sembrado__')) { localStorage.setItem(k, JSON.stringify(v)); localStorage.setItem('__sembrado__', '1'); }
    if (flag) localStorage.setItem(fk, '1'); else localStorage.removeItem(fk);
  }, { k: CLAVE_LOCAL, v: estadoLocal(), flag, fk: FLAG });
  const page = await context.newPage();
  return { context, page };
}
async function entrar(page, email) {
  await page.goto('/');
  await page.fill('#email-login', email);
  await page.fill('#pass-login', PASS);
  await page.getByRole('button', { name: /^Entrar$/i }).click();
  await expect(page.getByRole('button', { name: /Salir/i }).first()).toBeVisible({ timeout: 20000 });
  if (await page.getByRole('dialog', { name: /Guía de uso/i }).isVisible().catch(() => false)) await page.keyboard.press('Escape');
}
const inputCliente = (page) => page.locator('label.etiqueta', { hasText: /^Cliente$/ }).locator('xpath=following-sibling::input[1]');
const leerLocal = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '{}'), CLAVE_LOCAL);
const banner = (page) => page.getByTestId('conflicto-guardado');
async function abrirPrimeraDelArchivo(page) {
  await page.getByText('Más herramientas').click();
  await page.getByRole('button', { name: /^Presupuestos anteriores/ }).click();
  await expect(page.getByTestId('respaldo-local')).toBeVisible({ timeout: 10000 });
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: /^Abrir$/ }).first().click();
  await expect(inputCliente(page)).toBeVisible({ timeout: 10000 });
}
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const esperarGuardado = async (nube, cond, ms = 8000) => expect.poll(() => cond(nube), { timeout: ms }).toBe(true);
const intentosDeGuardado = (nube) => nube.llamadas.filter((l) => l.includes('/rest/v1/rpc/actualizar_cotizacion_segura')).length;

test.describe('VH-148 · control optimista entre dos pestañas', () => {
  test('A guarda; B (copia vieja) es rechazada, conserva lo suyo, el autosave se pausa; "Volver a aplicar" y "Ver la versión del servidor" funcionan', async ({ browser }) => {
    test.setTimeout(120_000);
    const nube = crearNubeFalsa({ usuarios: USUARIOS });
    const id = nube.sembrarFila({ usuario: 'ventas@vh.mx', cliente: 'Tradeco', partidas: [PARTIDA], total: 55680, piezas: 1 });
    const version0 = nube.filas.get(id).actualizado;

    // Las dos pestañas abren la MISMA cotización del Archivo: las dos conocen la misma versión.
    const A = await pestana(browser, nube), B = await pestana(browser, nube);
    await entrar(A.page, 'ventas@vh.mx'); await abrirPrimeraDelArchivo(A.page);
    await entrar(B.page, 'ventas@vh.mx'); await abrirPrimeraDelArchivo(B.page);
    expect((await leerLocal(A.page)).cotizacion).toMatchObject({ id, actualizado: version0 });
    expect((await leerLocal(B.page)).cotizacion).toMatchObject({ id, actualizado: version0 });
    await esperar(2000);
    expect(intentosDeGuardado(nube), 'abrir sin editar NO escribe').toBe(0);

    // --- A edita y guarda: ok, mandó su versión y recibió la nueva ---
    await inputCliente(A.page).fill('Tradeco Norte');
    await esperarGuardado(nube, (n) => n.filas.get(id).cliente === 'Tradeco Norte');
    const version1 = nube.filas.get(id).actualizado;
    expect(version1).not.toBe(version0);
    expect(nube.esperados).toEqual([version0]);
    await expect.poll(async () => (await leerLocal(A.page)).cotizacion.actualizado).toBe(version1);
    expect(nube.conflictos).toBe(0);

    // --- B edita con su copia vieja: el servidor la rechaza y B lo enseña ---
    await inputCliente(B.page).fill('Tradeco Sur');
    await expect(banner(B.page)).toBeVisible({ timeout: 10000 });
    await expect(banner(B.page)).toContainText(/Otra persona cambió esta cotización a las \d{2}:\d{2}\. Tus cambios siguen en esta computadora\./);
    await expect(banner(B.page)).toHaveAttribute('data-actualizado', version1);
    expect(nube.conflictos).toBe(1);
    expect(nube.esperados.at(-1)).toBe(version0);                 // B mandó la versión desde la que editaba
    expect(nube.filas.get(id).cliente, 'nada se escribió').toBe('Tradeco Norte');
    expect(nube.filas.get(id).actualizado).toBe(version1);
    await expect(inputCliente(B.page)).toHaveValue('Tradeco Sur');  // lo local sigue en pantalla…
    expect((await leerLocal(B.page)).cotizacion.cliente).toBe('Tradeco Sur');   // …y en esta computadora
    await expect(B.page.getByTestId('nube-estado')).toHaveAttribute('data-estado', 'conectado');   // no es un problema de red
    await expect(banner(A.page)).toBeHidden();                      // A no tiene nada que resolver

    // --- autosave EN PAUSA mientras el conflicto no se resuelva ---
    const intentos = intentosDeGuardado(nube);
    await inputCliente(B.page).fill('Tradeco Sur 2');
    await esperar(2500);
    expect(intentosDeGuardado(nube), 'con el aviso visible no se vuelve a intentar').toBe(intentos);
    expect(nube.conflictos).toBe(1);
    expect(nube.filas.get(id).cliente).toBe('Tradeco Norte');
    await expect(banner(B.page)).toBeVisible();

    // --- "Volver a aplicar mis cambios": UN clic, lo local encima de la versión del servidor ---
    await banner(B.page).getByRole('button', { name: 'Volver a aplicar mis cambios' }).click();
    await esperarGuardado(nube, (n) => n.filas.get(id).cliente === 'Tradeco Sur 2');
    expect(nube.esperados.at(-1)).toBe(version1);                 // con la versión fresca del error
    const version2 = nube.filas.get(id).actualizado;
    await expect(banner(B.page)).toBeHidden();
    await expect(B.page.locator('.toast')).toContainText(/quedaron guardados encima de la versión del servidor/i, { timeout: 10000 });
    await expect.poll(async () => (await leerLocal(B.page)).cotizacion.actualizado).toBe(version2);
    expect(nube.conflictos).toBe(1);
    expect(nube.filas.size).toBe(1);                              // nunca se duplicó la fila
    // B sigue editando normal (el autosave se reanudó).
    await inputCliente(B.page).fill('Tradeco Sur 3');
    await esperarGuardado(nube, (n) => n.filas.get(id).cliente === 'Tradeco Sur 3');
    expect(nube.conflictos).toBe(1);
    const version3 = nube.filas.get(id).actualizado;

    // --- ahora A es la vieja: edita → conflicto → "Ver la versión del servidor" ---
    await inputCliente(A.page).fill('Tradeco Norte 2');
    await expect(banner(A.page)).toBeVisible({ timeout: 10000 });
    expect(nube.conflictos).toBe(2);
    expect(nube.filas.get(id).cliente).toBe('Tradeco Sur 3');
    const intentosA = intentosDeGuardado(nube);
    await banner(A.page).getByRole('button', { name: 'Ver la versión del servidor' }).click();
    await expect(inputCliente(A.page)).toHaveValue('Tradeco Sur 3', { timeout: 10000 });   // lo del servidor en pantalla
    await expect(banner(A.page)).toBeHidden();
    await expect(A.page.locator('.toast')).toContainText(/Se cargó la versión del servidor/i, { timeout: 10000 });
    // Lo local de A quedó respaldado en SU computadora, con lo que tenía escrito.
    const respaldo = await A.page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), `costeador-vonhaucke-conflicto-${id}`);
    expect(respaldo).toMatchObject({ version: 'conflicto-vh-1', motivo: 'conflicto-de-version', actualizadoServidor: version3 });
    expect(respaldo.cotizacion).toMatchObject({ id, cliente: 'Tradeco Norte 2', actualizado: version1 });
    expect(respaldo.cotizacion.partidas).toHaveLength(1);
    const localA = await leerLocal(A.page);
    expect(localA.cotizacion).toMatchObject({ id, cliente: 'Tradeco Sur 3', actualizado: version3 });
    // Cargar la versión del servidor NO escribe nada (ya está en la nube).
    await esperar(2000);
    expect(intentosDeGuardado(nube)).toBe(intentosA);
    expect(nube.filas.get(id).cliente).toBe('Tradeco Sur 3');
    // Y A sigue editando normal desde la versión fresca.
    await inputCliente(A.page).fill('Tradeco Norte 3');
    await esperarGuardado(nube, (n) => n.filas.get(id).cliente === 'Tradeco Norte 3');
    expect(nube.esperados.at(-1)).toBe(version3);
    expect(nube.conflictos).toBe(2);
    expect(nube.filas.size).toBe(1);

    await A.context.close(); await B.context.close();
  });

  test('Dirección y vendedor también chocan entre sí (el control es por fila, no por rol)', async ({ browser }) => {
    test.setTimeout(90_000);
    const nube = crearNubeFalsa({ usuarios: USUARIOS });
    const id = nube.sembrarFila({ usuario: 'ventas@vh.mx', cliente: 'Alpura', partidas: [{ ...PARTIDA, costoUnitario: 21000, margen: 30 }], total: 55680, piezas: 1 });
    const V = await pestana(browser, nube), D = await pestana(browser, nube);
    await entrar(V.page, 'ventas@vh.mx'); await abrirPrimeraDelArchivo(V.page);
    await entrar(D.page, 'rodrigo@vh.mx'); await abrirPrimeraDelArchivo(D.page);
    await inputCliente(D.page).fill('Alpura Norte');
    await esperarGuardado(nube, (n) => n.filas.get(id).cliente === 'Alpura Norte');
    const costoTrasDireccion = nube.filas.get(id).partidas[0].costoUnitario;
    await inputCliente(V.page).fill('Alpura Sur');
    await expect(banner(V.page)).toBeVisible({ timeout: 10000 });
    expect(nube.conflictos).toBe(1);
    expect(nube.filas.get(id).cliente).toBe('Alpura Norte');
    expect(nube.filas.get(id).partidas[0].costoUnitario, 'el rechazo no tocó la fila').toBe(costoTrasDireccion);
    await V.context.close(); await D.context.close();
  });

  test('bandera APAGADA (producción hoy): nunca viaja p_actualizado_esperado y el último que escribe gana, sin aviso', async ({ browser }) => {
    test.setTimeout(90_000);
    const nube = crearNubeFalsa({ usuarios: USUARIOS });
    const id = nube.sembrarFila({ usuario: 'ventas@vh.mx', cliente: 'Lala', partidas: [PARTIDA], total: 55680, piezas: 1 });
    const A = await pestana(browser, nube, { flag: false }), B = await pestana(browser, nube, { flag: false });
    await entrar(A.page, 'ventas@vh.mx'); await abrirPrimeraDelArchivo(A.page);
    await entrar(B.page, 'ventas@vh.mx'); await abrirPrimeraDelArchivo(B.page);
    await inputCliente(A.page).fill('Lala Norte');
    await esperarGuardado(nube, (n) => n.filas.get(id).cliente === 'Lala Norte');
    await inputCliente(B.page).fill('Lala Sur');
    await esperarGuardado(nube, (n) => n.filas.get(id).cliente === 'Lala Sur');   // B pisó a A (el defecto, documentado)
    expect(nube.conflictos).toBe(0);
    expect(nube.esperados.every((v) => v === undefined)).toBe(true);
    await expect(banner(B.page)).toBeHidden();
    await A.context.close(); await B.context.close();
  });

  test('bandera PRENDIDA contra la RPC VIEJA (SQL aún no desplegado): la app sigue guardando sin control, sin errores', async ({ browser }) => {
    test.setTimeout(90_000);
    const nube = crearNubeFalsa({ usuarios: USUARIOS, rpcVieja: true });
    const id = nube.sembrarFila({ usuario: 'ventas@vh.mx', cliente: 'Oxxo', partidas: [PARTIDA], total: 55680, piezas: 1 });
    const A = await pestana(browser, nube);
    await entrar(A.page, 'ventas@vh.mx'); await abrirPrimeraDelArchivo(A.page);
    expect((await leerLocal(A.page)).cotizacion.actualizado ?? null).toBeNull();   // el servidor viejo no manda versión
    await inputCliente(A.page).fill('Oxxo Centro');
    await esperarGuardado(nube, (n) => n.filas.get(id).cliente === 'Oxxo Centro');
    expect(nube.esperados).toEqual([undefined]);                   // no se mandó el parámetro → no hubo PGRST202
    await expect(A.page.getByTestId('nube-estado')).toHaveAttribute('data-estado', 'conectado');
    await expect(banner(A.page)).toBeHidden();
    await inputCliente(A.page).fill('Oxxo Centro 2');
    await esperarGuardado(nube, (n) => n.filas.get(id).cliente === 'Oxxo Centro 2');
    expect(nube.esperados).toEqual([undefined, undefined]);
    await A.context.close();
  });
});
