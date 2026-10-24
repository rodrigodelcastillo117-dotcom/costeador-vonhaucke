// ============================================================================
//  VH-148 · CONCURRENCIA OPTIMISTA — dos "pestañas" (dos navegadores, mismo usuario) sobre la
//  misma cotización. Criterio de Dirección (2026-10-13):
//    · la pestaña A guarda → ok;
//    · la pestaña B, con su copia vieja, intenta guardar → el servidor la RECHAZA (40001),
//      lo local de B NO se pierde, aparece el aviso y el autosave queda en pausa;
//    · "Volver a aplicar mis cambios" → B guarda encima con la versión fresca (un clic);
//    · "Ver la versión del servidor" → carga lo del servidor y respalda lo local en esta computadora.
//  Segunda vuelta (auditoría: "conserva ambas versiones y exige resolución explícita; prueba guardado,
//  conflicto, recuperación y reapertura"):
//    · tras "Ver la versión del servidor" las DOS versiones siguen vivas (aviso RespaldoConflicto con lo
//      que difiere) y sobreviven una recarga;
//    · "Recuperar mis cambios" = fusión de tres vías POR CAMPO encima de la versión ACTUAL del servidor,
//      guardada con su `actualizado` (sin 40001); si reemplaza algo que la otra persona también cambió,
//      pide confirmación;
//    · reabrir en otra computadora trae lo recuperado de B + lo de A que B no tocó;
//    · "Descartar mi respaldo" pide confirmación y sólo entonces borra la clave.
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
  await expect(page.getByRole('button', { name: /Salir/i }).first()).toBeVisible({ timeout: 45000 });
  if (await page.getByRole('dialog', { name: /Guía de uso/i }).isVisible().catch(() => false)) await page.keyboard.press('Escape');
}
const inputCliente = (page) => page.locator('label.etiqueta', { hasText: /^Cliente$/ }).locator('xpath=following-sibling::input[1]');
const inputFolio = (page) => page.locator('label.etiqueta', { hasText: /^Folio de la propuesta$/ }).locator('xpath=following-sibling::div[1]//input');
const avisoRespaldo = (page) => page.getByTestId('respaldo-conflicto');
const leerRespaldo = (page, id) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), `costeador-vonhaucke-conflicto-${id}`);
const filaDif = (page, campo) => avisoRespaldo(page).locator(`tr[data-campo="${campo}"]`);
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
// Diálogos (confirm) registrados; `responder` decide aceptar (true) o cancelar (false) cada uno.
function registrarDialogos(page) {
  const vistos = []; let responder = () => true;
  // abrirPrimeraDelArchivo deja un `once('dialog', accept)` sin consumir si no hubo confirm al abrir:
  // se quita para que NINGÚN confirm de estas pruebas se acepte solo.
  page.removeAllListeners('dialog');
  page.on('dialog', async (d) => { vistos.push(d.message()); if (responder(d.message())) await d.accept(); else await d.dismiss(); });
  return { vistos, responderCon(fn) { responder = fn; } };
}
// A y B abren la misma fila; A cambia lo suyo y guarda; B cambia lo suyo → 40001; B escoge "Ver la versión
// del servidor". Devuelve las pestañas y la versión que A dejó.
async function conflictoYVersionDelServidor(browser, nube, id, { editaA, editaB }) {
  const A = await pestana(browser, nube), B = await pestana(browser, nube);
  await entrar(A.page, 'ventas@vh.mx'); await abrirPrimeraDelArchivo(A.page);
  await entrar(B.page, 'ventas@vh.mx'); await abrirPrimeraDelArchivo(B.page);
  const updatesAntes = nube.updates;
  await editaA(A.page);
  await esperarGuardado(nube, (n) => n.updates === updatesAntes + 1);
  const versionA = nube.filas.get(id).actualizado;
  const filaTrasA = JSON.parse(JSON.stringify(nube.filas.get(id)));
  await editaB(B.page);
  await expect(banner(B.page)).toBeVisible({ timeout: 10000 });
  await expect(banner(B.page).getByTestId('conflicto-explicacion')).toContainText(/guarda tu versión COMPLETA y reemplaza lo que la otra persona cambió/);
  expect(nube.conflictos).toBe(1);
  expect(nube.filas.get(id), 'el rechazo no tocó la fila').toEqual(filaTrasA);
  await banner(B.page).getByRole('button', { name: 'Ver la versión del servidor' }).click();
  await expect(banner(B.page)).toBeHidden({ timeout: 10000 });
  await expect(avisoRespaldo(B.page)).toBeVisible({ timeout: 10000 });
  return { A, B, versionA, filaTrasA };
}

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
    // VH-148b: texto EXACTO acordado (conflictoGuardado.js · MENSAJE_VERSION_CONFLICT).
    await expect(B.page.getByTestId('conflicto-mensaje')).toHaveText('Existe una versión más reciente. Recarga o compara antes de guardar.');
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

    // --- "Volver a aplicar mis cambios": reemplaza lo de A con el documento COMPLETO → pide confirmación (P1-REL-02) ---
    const dlgB = registrarDialogos(B.page);
    dlgB.responderCon(() => false);   // primero cancela: no se manda nada
    await banner(B.page).getByRole('button', { name: 'Volver a aplicar mis cambios' }).click();
    await expect.poll(() => dlgB.vistos.length).toBe(1);
    expect(dlgB.vistos[0]).toMatch(/Vas a guardar TU versión completa encima/);
    await esperar(1500);
    expect(nube.filas.get(id).cliente, 'cancelar no escribe').toBe('Tradeco Norte');
    await expect(banner(B.page)).toBeVisible();
    dlgB.responderCon(() => true);
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
    await expect(avisoRespaldo(B.page)).toBeHidden();             // sin bandera tampoco hay aviso de respaldo
    await A.context.close(); await B.context.close();
  });

  // VH-148b · FAIL-CLOSED: antes la bandera prendida sin versión conocida caía en la firma de dos argumentos y
  // guardaba SIN control. Ahora no se escribe a ciegas: se enseña el aviso y la persona recarga o compara.
  test('bandera PRENDIDA contra la RPC VIEJA (SQL aún no desplegado): NO escribe a ciegas y avisa (fail-closed)', async ({ browser }) => {
    test.setTimeout(90_000);
    const nube = crearNubeFalsa({ usuarios: USUARIOS, rpcVieja: true });
    const id = nube.sembrarFila({ usuario: 'ventas@vh.mx', cliente: 'Oxxo', partidas: [PARTIDA], total: 55680, piezas: 1 });
    const A = await pestana(browser, nube);
    await entrar(A.page, 'ventas@vh.mx'); await abrirPrimeraDelArchivo(A.page);
    expect((await leerLocal(A.page)).cotizacion.actualizado ?? null).toBeNull();   // el servidor viejo no manda versión
    await inputCliente(A.page).fill('Oxxo Centro');
    await expect(banner(A.page)).toBeVisible({ timeout: 10000 });
    await expect(A.page.getByTestId('conflicto-mensaje')).toHaveText('Existe una versión más reciente. Recarga o compara antes de guardar.');
    expect(nube.esperados).toEqual([]);                             // no salió ninguna escritura
    expect(nube.filas.get(id).cliente).toBe('Oxxo');
    await expect(inputCliente(A.page)).toHaveValue('Oxxo Centro');   // lo local sigue en pantalla
    await A.context.close();
  });
  test('recuperación + reapertura: B recupera SU folio encima del cliente de A, guarda con la versión fresca (sin 40001) y al reabrir en otra computadora están los dos', async ({ browser }) => {
    test.setTimeout(150_000);
    const nube = crearNubeFalsa({ usuarios: USUARIOS });
    const id = nube.sembrarFila({ usuario: 'ventas@vh.mx', cliente: 'Bimbo', partidas: [PARTIDA], total: 55680, piezas: 1 });

    // --- guardado (A) y conflicto (B): nada se sobrescribe ---
    const { A, B, versionA } = await conflictoYVersionDelServidor(browser, nube, id, {
      editaA: (p) => inputCliente(p).fill('Bimbo Norte'),     // A sólo toca el cliente
      editaB: (p) => inputFolio(p).fill('F-B-77'),            // B sólo toca el folio
    });
    expect(nube.filas.get(id)).toMatchObject({ cliente: 'Bimbo Norte', folio: null, actualizado: versionA });
    const dialogosB = registrarDialogos(B.page);

    // --- las DOS versiones vivas: la del servidor en pantalla, la de B en el respaldo y en el aviso ---
    await expect(inputCliente(B.page)).toHaveValue('Bimbo Norte');
    await expect(inputFolio(B.page)).toHaveValue('');
    const respaldo = await leerRespaldo(B.page, id);
    expect(respaldo.cotizacion).toMatchObject({ id, cliente: 'Bimbo', folio: 'F-B-77' });
    expect(respaldo.base).toMatchObject({ cliente: 'Bimbo', folio: '' });      // desde dónde editaba B
    await expect(filaDif(B.page, 'cliente')).toHaveAttribute('data-distinto', '1');
    await expect(filaDif(B.page, 'cliente')).toContainText('Bimbo');
    await expect(filaDif(B.page, 'cliente')).toContainText('Bimbo Norte');
    await expect(filaDif(B.page, 'folio')).toContainText('F-B-77');
    await expect(filaDif(B.page, 'partidas')).toHaveAttribute('data-distinto', '0');
    await expect(filaDif(B.page, 'total')).toBeVisible();
    await expect(avisoRespaldo(B.page).getByTestId('respaldo-plan')).toContainText('Se aplicarán tus cambios en: Folio.');
    await expect(avisoRespaldo(B.page).getByTestId('respaldo-plan')).toContainText('Se queda lo de la otra persona en: Cliente.');
    await expect(avisoRespaldo(B.page).getByTestId('respaldo-plan')).not.toContainText(/REEMPLAZAR/);
    // ver la versión del servidor no escribe nada, y el respaldo NO se resuelve solo
    const intentos = intentosDeGuardado(nube);
    await esperar(2500);
    expect(intentosDeGuardado(nube)).toBe(intentos);
    await expect(avisoRespaldo(B.page)).toBeVisible();

    // --- el respaldo sobrevive una recarga (sigue en esta computadora, con su base) ---
    await B.page.reload();
    await expect(avisoRespaldo(B.page)).toBeVisible({ timeout: 20000 });
    expect(await leerRespaldo(B.page, id)).toEqual(respaldo);
    expect(intentosDeGuardado(nube), 'recargar no escribe').toBe(intentos);

    // --- "Recuperar mis cambios": relee el servidor, aplica SOLO el folio, guarda con la versión fresca ---
    await avisoRespaldo(B.page).getByRole('button', { name: 'Recuperar mis cambios' }).click();
    await esperarGuardado(nube, (n) => n.filas.get(id).folio === 'F-B-77');
    expect(dialogosB.vistos, 'sin choque no se pide confirmación').toEqual([]);
    expect(nube.esperados.at(-1), 'se guardó encima de la versión ACTUAL del servidor').toBe(versionA);
    expect(nube.conflictos, 'sin 40001 al recuperar').toBe(1);
    expect(nube.filas.get(id)).toMatchObject({ cliente: 'Bimbo Norte', folio: 'F-B-77' });   // lo de A se quedó
    const versionR = nube.filas.get(id).actualizado;
    expect(versionR).not.toBe(versionA);
    await expect(avisoRespaldo(B.page)).toBeHidden({ timeout: 10000 });
    await expect(B.page.locator('.toast')).toContainText(/recuperaste tus cambios \(Folio\) encima de la versión del servidor/i, { timeout: 10000 });
    expect(await leerRespaldo(B.page, id), 'el respaldo se retiró sólo tras el guardado confirmado').toBeNull();
    // (tras la recarga la app vuelve a Inicio: lo vivo se lee del estado local, no de los inputs)
    await expect.poll(async () => (await leerLocal(B.page)).cotizacion.actualizado).toBe(versionR);
    expect((await leerLocal(B.page)).cotizacion).toMatchObject({ id, cliente: 'Bimbo Norte', folio: 'F-B-77' });
    const intentosTras = intentosDeGuardado(nube);
    await esperar(2500);
    expect(intentosDeGuardado(nube), 'el autosave no reenvía lo recuperado').toBe(intentosTras);
    expect(nube.filas.size).toBe(1);

    // --- CERRAR y REABRIR en otra computadora (contexto nuevo, localStorage vacío) ---
    await A.context.close(); await B.context.close();
    const C = await pestana(browser, nube);
    await entrar(C.page, 'ventas@vh.mx'); await abrirPrimeraDelArchivo(C.page);
    await expect(inputCliente(C.page)).toHaveValue('Bimbo Norte');   // de A (B no lo tocó)
    await expect(inputFolio(C.page)).toHaveValue('F-B-77');          // de B (recuperado)
    expect((await leerLocal(C.page)).cotizacion).toMatchObject({ id, cliente: 'Bimbo Norte', folio: 'F-B-77', actualizado: versionR });
    expect((await leerLocal(C.page)).cotizacion.partidas).toHaveLength(1);
    await expect(avisoRespaldo(C.page)).toBeHidden();
    await expect(banner(C.page)).toBeHidden();
    // y se sigue editando normal desde la versión recuperada
    await inputCliente(C.page).fill('Bimbo Norte 2');
    await esperarGuardado(nube, (n) => n.filas.get(id).cliente === 'Bimbo Norte 2');
    expect(nube.esperados.at(-1)).toBe(versionR);
    expect(nube.filas.get(id).folio).toBe('F-B-77');
    expect(nube.conflictos).toBe(1);
    await C.context.close();
  });

  test('choque: los dos cambiaron el cliente → "Recuperar" pide confirmación; cancelar no toca nada; aceptar reemplaza con la versión fresca', async ({ browser }) => {
    test.setTimeout(120_000);
    const nube = crearNubeFalsa({ usuarios: USUARIOS });
    const id = nube.sembrarFila({ usuario: 'ventas@vh.mx', cliente: 'Sigma', partidas: [PARTIDA], total: 55680, piezas: 1 });
    const { A, B, versionA } = await conflictoYVersionDelServidor(browser, nube, id, {
      editaA: (p) => inputCliente(p).fill('Sigma Norte'),
      editaB: (p) => inputCliente(p).fill('Sigma Sur'),
    });
    await expect(avisoRespaldo(B.page).getByTestId('respaldo-plan')).toContainText('Los dos cambiaron Cliente: tu versión REEMPLAZARÁ la de la otra persona');
    const d = registrarDialogos(B.page);
    // cancelar → nada cambia (ni servidor ni respaldo)
    d.responderCon(() => false);
    const updates = nube.updates, intentos = intentosDeGuardado(nube);
    await avisoRespaldo(B.page).getByRole('button', { name: 'Recuperar mis cambios' }).click();
    await expect.poll(() => d.vistos.length).toBe(1);
    expect(d.vistos[0]).toMatch(/La otra persona también cambió: Cliente\./);
    await esperar(2000);
    expect(nube.updates).toBe(updates);
    expect(intentosDeGuardado(nube)).toBe(intentos);
    expect(nube.filas.get(id).cliente).toBe('Sigma Norte');
    await expect(inputCliente(B.page)).toHaveValue('Sigma Norte');
    expect((await leerRespaldo(B.page, id)).cotizacion.cliente).toBe('Sigma Sur');
    await expect(avisoRespaldo(B.page)).toBeVisible();
    // aceptar → la versión de B reemplaza, con la versión fresca, sin 40001
    d.responderCon(() => true);
    await avisoRespaldo(B.page).getByRole('button', { name: 'Recuperar mis cambios' }).click();
    await esperarGuardado(nube, (n) => n.filas.get(id).cliente === 'Sigma Sur');
    expect(d.vistos).toHaveLength(2);
    expect(nube.esperados.at(-1)).toBe(versionA);
    expect(nube.conflictos).toBe(1);
    await expect(avisoRespaldo(B.page)).toBeHidden({ timeout: 10000 });
    expect(await leerRespaldo(B.page, id)).toBeNull();
    await A.context.close(); await B.context.close();
  });

  test('"Descartar mi respaldo" pide confirmación: cancelar lo conserva; aceptar borra la clave y no toca el servidor', async ({ browser }) => {
    test.setTimeout(120_000);
    const nube = crearNubeFalsa({ usuarios: USUARIOS });
    const id = nube.sembrarFila({ usuario: 'ventas@vh.mx', cliente: 'Lamosa', partidas: [PARTIDA], total: 55680, piezas: 1 });
    const { A, B } = await conflictoYVersionDelServidor(browser, nube, id, {
      editaA: (p) => inputCliente(p).fill('Lamosa Norte'),
      editaB: (p) => inputFolio(p).fill('F-DESC'),
    });
    const clave = `costeador-vonhaucke-conflicto-${id}`;
    const d = registrarDialogos(B.page);
    const filaAntes = JSON.parse(JSON.stringify(nube.filas.get(id)));
    const intentos = intentosDeGuardado(nube);
    d.responderCon(() => false);
    await avisoRespaldo(B.page).getByRole('button', { name: 'Descartar mi respaldo' }).click();
    await expect.poll(() => d.vistos.length).toBe(1);
    expect(d.vistos[0]).toMatch(/^¿Descartar tu respaldo de las \d{2}:\d{2}\?/);
    expect(d.vistos[0]).toMatch(/NO se puede recuperar/);
    await esperar(500);
    expect(await B.page.evaluate((k) => localStorage.getItem(k) !== null, clave), 'sin confirmar, la clave se queda').toBe(true);
    await expect(avisoRespaldo(B.page)).toBeVisible();
    d.responderCon(() => true);
    await avisoRespaldo(B.page).getByRole('button', { name: 'Descartar mi respaldo' }).click();
    await expect(avisoRespaldo(B.page)).toBeHidden({ timeout: 10000 });
    expect(d.vistos).toHaveLength(2);
    expect(await B.page.evaluate((k) => localStorage.getItem(k), clave), 'confirmado: la clave ya no existe').toBeNull();
    await expect(B.page.locator('.toast')).toContainText(/Respaldo descartado/i, { timeout: 10000 });
    await esperar(2000);
    expect(intentosDeGuardado(nube), 'descartar no escribe').toBe(intentos);
    expect(nube.filas.get(id)).toEqual(filaAntes);
    await expect(inputFolio(B.page)).toHaveValue('');
    await A.context.close(); await B.context.close();
  });

  // P1-REL-02 (cierre ChatGPT v3, F): recargar con un conflicto SIN RESOLVER ya no reenvía lo local ni deja el aviso
  // eterno: respalda lo local y enseña la versión del servidor; recuperar sigue siendo decisión explícita.
  test('recargar con el conflicto abierto: en pantalla queda la versión del servidor y lo local queda respaldado', async ({ browser }) => {
    test.setTimeout(120_000);
    const nube = crearNubeFalsa({ usuarios: USUARIOS });
    const id = nube.sembrarFila({ usuario: 'ventas@vh.mx', cliente: 'Tradeco', partidas: [PARTIDA], total: 55680, piezas: 1 });
    const A = await pestana(browser, nube), B = await pestana(browser, nube);
    await entrar(A.page, 'ventas@vh.mx'); await abrirPrimeraDelArchivo(A.page);
    await entrar(B.page, 'ventas@vh.mx'); await abrirPrimeraDelArchivo(B.page);
    await inputCliente(A.page).fill('Tradeco Norte');
    await esperarGuardado(nube, (n) => n.filas.get(id).cliente === 'Tradeco Norte');
    await inputCliente(B.page).fill('Tradeco Sur');
    await expect(banner(B.page)).toBeVisible({ timeout: 10000 });
    const intentos = intentosDeGuardado(nube);
    await B.page.reload();
    await expect(avisoRespaldo(B.page)).toBeVisible({ timeout: 20000 });                     // lo suyo, respaldado
    await expect(filaDif(B.page, 'cliente')).toContainText('Tradeco Sur');                    // tu respaldo
    await expect(filaDif(B.page, 'cliente')).toContainText('Tradeco Norte');                  // versión del servidor
    await expect.poll(async () => (await leerLocal(B.page)).cotizacion?.cliente, { timeout: 10000 }).toBe('Tradeco Norte');
    await expect(banner(B.page)).toBeHidden();
    expect((await leerRespaldo(B.page, id)).cotizacion.cliente).toBe('Tradeco Sur');
    await esperar(2500);
    expect(nube.filas.get(id).cliente, 'recargar NO pisó el servidor').toBe('Tradeco Norte');
    expect(intentosDeGuardado(nube) - intentos, 'recargar no reenvió lo local').toBe(0);
    expect(await B.page.evaluate((k) => localStorage.getItem(k), `costeador-vonhaucke-conflicto-abierto-${id}`)).toBeNull();
    await A.context.close(); await B.context.close();
  });

  test('abrir otro presupuesto desde la lista con el conflicto abierto respalda lo local antes de reemplazarlo', async ({ browser }) => {
    test.setTimeout(120_000);
    const nube = crearNubeFalsa({ usuarios: USUARIOS });
    const id = nube.sembrarFila({ usuario: 'ventas@vh.mx', cliente: 'Tradeco', partidas: [PARTIDA], total: 55680, piezas: 1 });
    const A = await pestana(browser, nube), B = await pestana(browser, nube);
    await entrar(A.page, 'ventas@vh.mx'); await abrirPrimeraDelArchivo(A.page);
    await entrar(B.page, 'ventas@vh.mx'); await abrirPrimeraDelArchivo(B.page);
    await inputCliente(A.page).fill('Tradeco Norte');
    await esperarGuardado(nube, (n) => n.filas.get(id).cliente === 'Tradeco Norte');
    await inputCliente(B.page).fill('Tradeco Sur');
    await expect(banner(B.page)).toBeVisible({ timeout: 10000 });
    await B.page.getByRole('button', { name: /^Inicio$/ }).click();
    B.page.removeAllListeners('dialog');   // el `once` del primer abrir pudo quedar sin consumir
    await abrirPrimeraDelArchivo(B.page);
    expect((await leerRespaldo(B.page, id))?.cotizacion?.cliente, 'lo local quedó respaldado').toBe('Tradeco Sur');
    expect(nube.filas.get(id).cliente).toBe('Tradeco Norte');
    await A.context.close(); await B.context.close();
  });
  // Cierre v3 (lab A–L contra la preview, punto G): A cambia el FOLIO, B el CLIENTE → conflicto → B ve el servidor →
  // RECARGA → "Recuperar mis cambios": el folio de A tiene que seguir (sólo se aplica lo que B cambió).
  test('recuperar después de recargar conserva lo que cambió la otra persona', async ({ browser }) => {
    test.setTimeout(120_000);
    const nube = crearNubeFalsa({ usuarios: USUARIOS });
    const id = nube.sembrarFila({ usuario: 'ventas@vh.mx', cliente: 'Tradeco', partidas: [PARTIDA], total: 55680, piezas: 1 });
    const A = await pestana(browser, nube), B = await pestana(browser, nube);
    await entrar(A.page, 'ventas@vh.mx'); await abrirPrimeraDelArchivo(A.page);
    await entrar(B.page, 'ventas@vh.mx'); await abrirPrimeraDelArchivo(B.page);
    await inputFolio(A.page).fill('FOL-A1');
    await esperarGuardado(nube, (n) => n.filas.get(id).folio === 'FOL-A1');
    await inputCliente(B.page).fill('Tradeco B');
    await expect(banner(B.page)).toBeVisible({ timeout: 10000 });
    await banner(B.page).getByRole('button', { name: 'Ver la versión del servidor' }).click();
    await expect(avisoRespaldo(B.page)).toBeVisible({ timeout: 10000 });
    await B.page.reload();
    await expect(avisoRespaldo(B.page)).toBeVisible({ timeout: 20000 });
    const dl = registrarDialogos(B.page);
    await avisoRespaldo(B.page).getByRole('button', { name: 'Recuperar mis cambios' }).click();
    await esperarGuardado(nube, (n) => n.filas.get(id).cliente === 'Tradeco B');
    expect(nube.filas.get(id).folio, 'lo de A (folio) sigue').toBe('FOL-A1');
    expect(dl.vistos, 'sin choque no se pregunta nada').toEqual([]);
    await A.context.close(); await B.context.close();
  });
  // Cierre v3 (carrera real vista en el lab A–L contra la preview): recargar MIENTRAS "Ver la versión del servidor" todavía
  // está leyendo el servidor. Antes: segundo respaldo del mismo documento SIN base → "Recuperar" pisaba el folio de A y el
  // primer respaldo quedaba huérfano. Ahora: un solo respaldo, con base; el folio de A sobrevive.
  test('recargar a media "Ver la versión del servidor" no duplica el respaldo ni pisa lo de la otra persona', async ({ browser }) => {
    test.setTimeout(120_000);
    const nube = crearNubeFalsa({ usuarios: USUARIOS });
    const id = nube.sembrarFila({ usuario: 'ventas@vh.mx', cliente: 'Tradeco', partidas: [PARTIDA], total: 55680, piezas: 1 });
    const A = await pestana(browser, nube), B = await pestana(browser, nube);
    await entrar(A.page, 'ventas@vh.mx'); await abrirPrimeraDelArchivo(A.page);
    await entrar(B.page, 'ventas@vh.mx'); await abrirPrimeraDelArchivo(B.page);
    await inputFolio(A.page).fill('FOL-A1');
    await esperarGuardado(nube, (n) => n.filas.get(id).folio === 'FOL-A1');
    await inputCliente(B.page).fill('Tradeco B');
    await expect(banner(B.page)).toBeVisible({ timeout: 10000 });
    let lento = true;
    await B.page.route('**/rest/v1/rpc/cotizacion_segura**', async (r) => { if (lento) await esperar(4000); await r.fallback(); });
    await banner(B.page).getByRole('button', { name: 'Ver la versión del servidor' }).click();
    await expect(avisoRespaldo(B.page)).toBeVisible({ timeout: 10000 });   // el respaldo ya se escribió; el servidor aún no llega
    await B.page.reload();
    lento = false;
    await expect(avisoRespaldo(B.page)).toBeVisible({ timeout: 20000 });
    await expect.poll(async () => (await leerLocal(B.page)).cotizacion?.folio, { timeout: 15000 }).toBe('FOL-A1');
    const resp = await leerRespaldo(B.page, id);
    expect(resp.anteriores, 'un solo respaldo (no el mismo documento dos veces)').toBeUndefined();
    expect(resp.base, 'el respaldo conserva la base de la fusión').toBeTruthy();
    const dl = registrarDialogos(B.page);
    await avisoRespaldo(B.page).getByRole('button', { name: 'Recuperar mis cambios' }).click();
    await esperarGuardado(nube, (n) => n.filas.get(id).cliente === 'Tradeco B');
    expect(nube.filas.get(id).folio, 'el folio de A sobrevive').toBe('FOL-A1');
    expect(dl.vistos, 'sin choque no se pregunta').toEqual([]);
    await expect.poll(async () => leerRespaldo(B.page, id), { timeout: 10000 }).toBeNull();   // no queda respaldo huérfano
    await A.context.close(); await B.context.close();
  });
});
