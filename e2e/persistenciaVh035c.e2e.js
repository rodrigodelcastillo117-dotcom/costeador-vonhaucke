// ============================================================================
//  BLOQUE 1 · PERSISTENCIA con la PROPUESTA VH-035c (NO aplicada en producción).
//  Mismo navegador real y misma nube falsa que e2e/persistencia.e2e.js, pero con
//  `crearNubeFalsa({ preservaEconomia: 'vh035c' })`: espejo JS de
//  PROPUESTA_vh035c_preserva_economia_integral.sql (paridad SQL↔espejo probada en
//  supabase/tests/espejoNubeFalsaVh035c.test.js; SQL compuesta con VH-148 en
//  supabase/tests/composicionVh035cVh148.test.js).
//   1. El escenario de persistencia.e2e.js "vendedor abre, edita y guarda → costos internos
//      intactos" — que con la nube de PRODUCCIÓN queda ROJO a propósito en persistencia.e2e.js:125
//      (VH-035) — aquí pasa: la economía de Dirección sobrevive al guardado del vendedor.
//   2. STALE por cambio de producto: el vendedor (desde otro dispositivo, por la RPC de TRES
//      argumentos con su versión) cambia la pieza del renglón → la nube marca recosteo pendiente,
//      la emisión queda bloqueada para vendedor y Dirección y no se registra ninguna revisión.
//   3. STALE por definición (VH-035c §8): el vendedor guarda el renglón con otro nombre y medidas →
//      recosteo pendiente con texto humano; Dirección recostea y vuelve a estar lista.
//   4. Sin falso positivo de definición: "+" en un mueble SIN costo por lote conserva el costo y sigue lista.
//   5. STALE por lote desde la interfaz: el vendedor sube la cantidad de un mueble costeado por lote
//      con el botón "+" → recosteo pendiente → emisión bloqueada.
//  Nada toca producción. persistencia.e2e.js NO se modifica.
// ============================================================================
import { test, expect } from '@playwright/test';
import { crearNubeFalsa, estadoLocal, CLAVE_LOCAL, HOST, tokenDe } from './nubeFalsa.js';

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
const leerLocal = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '{}'), CLAVE_LOCAL);
const inputCliente = (page) => page.locator('label.etiqueta', { hasText: /^Cliente$/ }).locator('xpath=following-sibling::input[1]');
async function irAArchivo(page) {
  await page.getByText('Más herramientas').click();   // inicio vivo: tres tarjetas + atajos plegados
  await page.getByRole('button', { name: /^Presupuestos anteriores/ }).click();
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
const botonPDF = (page) => page.locator('button.cot-pdf');
const verificar = (page) => page.getByRole('button', { name: /Verificar emisión/i });
async function abrirComo(browser, nube, email) {
  const ctx = await browser.newContext({ acceptDownloads: true }); await nube.instalar(ctx);
  await sembrarLocal(ctx, estadoLocal());
  const page = await ctx.newPage();
  await entrar(page, email);
  await abrirPrimeraDelArchivo(page);
  return { ctx, page };
}
// Llamada a la nube (falsa) DESDE EL NAVEGADOR como `email`: lo que mandaría su otro dispositivo.
async function rpcDesdeNavegador(page, email, fn, body) {
  return page.evaluate(async ({ url, token, body }) => {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: 'anon', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
    return { status: r.status, json: await r.json() };
  }, { url: `${HOST}/rest/v1/rpc/${fn}`, token: tokenDe(email), body });
}

test.describe('Bloque 1 · persistencia con VH-035c (propuesta)', () => {
  test('vendedor abre, edita y guarda → los costos internos de Dirección quedan intactos; Dirección reabre y los ve', async ({ browser }) => {
    const nube = crearNubeFalsa({ usuarios: USUARIOS, preservaEconomia: 'vh035c' });
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
    expect(localV.cotizacion.partidas[0]).not.toHaveProperty('cost_status');
    // VH-035c §8: lo que la interfaz REALMENTE manda al guardar (para probar que el guardado legítimo, con sus
    // partidas tal cual llegaron, no se confunde con un cambio de definición).
    const patches = [];
    v.on('request', (r) => { if (r.url().includes('/rpc/actualizar_cotizacion_segura')) patches.push(r.postDataJSON()); });
    const updatesAntes = nube.updates;
    await esperar(2000);
    expect(nube.updates, 'reabrir sin editar NO escribe').toBe(updatesAntes);
    // Edita y guarda.
    await inputCliente(v).fill('Tradeco Monterrey');
    await esperarGuardado(nube, (n) => n.filas.get(id).cliente === 'Tradeco Monterrey');
    const fila = nube.filas.get(id);
    expect(fila.partidas[0].costoUnitario).toBe(21000);   // INTACTO (en persistencia.e2e.js:125 esto es ROJO con la nube de producción)
    expect(fila.partidas[0].margen).toBe(30);
    expect(fila.partidas[0].costoDerivado).toBe(false);
    expect(fila.partidas[0].cost_status).toBe('KNOWN');
    expect(fila.partidas[0]).not.toHaveProperty('cost_stale');   // mismo mueble: no hay recosteo pendiente
    // El guardado sí llevó las partidas (no sólo el cliente): la definición del renglón llegó idéntica a la guardada.
    expect(patches.some((b) => Array.isArray(b?.p_patch?.partidas) && b.p_patch.partidas[0]?.id === 'p1')).toBe(true);
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

  test('STALE: el vendedor cambia el producto del renglón (RPC de tres argumentos) → recosteo pendiente y emisión bloqueada para vendedor y Dirección', async ({ browser }) => {
    test.setTimeout(90_000);
    const nube = crearNubeFalsa({ usuarios: USUARIOS, preservaEconomia: 'vh035c' });
    const id = nube.sembrarFila({ usuario: 'ventas@vh.mx', cliente: 'Tradeco', partidas: [{ ...PARTIDA_CON_ECONOMIA, piezaId: 'bench-6' }], total: 55680, piezas: 1 });

    // Antes del cambio: la cotización está lista para emitir (precio 48,000 sobre costo 21,000).
    const { ctx, page } = await abrirComo(browser, nube, 'ventas@vh.mx');
    await verificar(page).click();
    await expect(page.getByText(/Lista para emitir/)).toBeVisible({ timeout: 15000 });

    // Su OTRO dispositivo: lee la versión y guarda el renglón con otra pieza (Banca de 8 usuarios),
    // con control optimista (tres argumentos). La economía de la Banca de 6 ya no le pertenece.
    const seg = await rpcDesdeNavegador(page, 'ventas@vh.mx', 'cotizacion_segura', { p_id: id });
    expect(seg.json.ok).toBe(true);
    expect(seg.json.partidas[0]).not.toHaveProperty('costoUnitario');
    const partidas = seg.json.partidas.map((p) => ({ ...p, piezaId: 'bench-8', nombre: 'Banca APP LT 8 usuarios' }));
    const r = await rpcDesdeNavegador(page, 'ventas@vh.mx', 'actualizar_cotizacion_segura', { p_cotizacion_id: id, p_patch: { partidas }, p_actualizado_esperado: seg.json.actualizado });
    expect(r.status).toBe(200);
    expect(r.json.ok).toBe(true);
    expect(r.json.partidas[0]).not.toHaveProperty('cost_stale');            // la marca es economía: el vendedor no la ve
    const p1 = nube.filas.get(id).partidas[0];
    expect(p1).not.toHaveProperty('costoUnitario');                         // no se recicla el costo de la Banca de 6
    expect(p1.cost_status).toBe('UNKNOWN');
    expect(p1.cost_stale).toMatchObject({ motivo: 'RECOSTEO_PRODUCTO_CAMBIADO', campos: ['piezaId'], previo: { piezaId: 'bench-6' } });
    expect(p1.cost_stale.economia_previa).toMatchObject({ costoUnitario: 21000, margen: 30 });   // auditable, no perdida
    // Re-guardar con la versión VIEJA (la otra pestaña) choca: PT409 y nada cambia (VH-148 delante del núcleo VH-035c).
    const antes = JSON.stringify(nube.filas.get(id));
    const viejo = await rpcDesdeNavegador(page, 'ventas@vh.mx', 'actualizar_cotizacion_segura', { p_cotizacion_id: id, p_patch: { partidas: seg.json.partidas }, p_actualizado_esperado: seg.json.actualizado });
    expect(viejo.json.code).toBe('PT409');
    expect(JSON.stringify(nube.filas.get(id))).toBe(antes);

    // El vendedor reabre: la emisión queda bloqueada con el motivo de recosteo.
    await ctx.close();
    const { ctx: ctx2, page: v } = await abrirComo(browser, nube, 'ventas@vh.mx');
    await expect(inputCliente(v)).toHaveValue('Tradeco');
    await verificar(v).click();
    await expect(v.getByText(/Faltan datos para cotizar/)).toBeVisible({ timeout: 15000 });
    // emisionUX: el motivo se dice en palabras (el código crudo ya no llega a la persona).
    await expect(v.getByText(/Línea 1: cambió el producto, su versión o su despiece; su costo anterior ya no vale/)).toBeVisible();
    await expect(v.getByText(/recosteo_pendiente_/)).toHaveCount(0);
    await botonPDF(v).click();
    await expect(v.locator('.aviso.rojo', { hasText: /BORRADOR · NO REGISTRADO/ })).toBeVisible({ timeout: 20000 });
    expect(nube.revisiones).toHaveLength(0);
    expect(nube.llamadas.some((l) => l.includes('/rpc/emitir_revision'))).toBe(false);
    await ctx2.close();

    // Dirección también: la compuerta lee la FILA, no lo que diga el cliente.
    const { ctx: cd, page: d } = await abrirComo(browser, nube, 'rodrigo@vh.mx');
    expect((await leerLocal(d)).cotizacion.partidas[0].cost_stale.motivo).toBe('RECOSTEO_PRODUCTO_CAMBIADO');
    await verificar(d).click();
    await expect(d.getByText(/Faltan datos para cotizar/)).toBeVisible({ timeout: 15000 });
    // emisionUX: el motivo se dice en palabras (el código crudo ya no llega a la persona).
    await expect(d.getByText(/Línea 1: cambió el producto, su versión o su despiece; su costo anterior ya no vale/)).toBeVisible();
    await expect(d.getByText(/recosteo_pendiente_/)).toHaveCount(0);
    expect(nube.revisiones).toHaveLength(0);
    await cd.close();
  });

  test('STALE por DEFINICIÓN (VH-035c §8): el vendedor guarda el renglón con otro nombre y medidas → recosteo pendiente, texto humano, emisión bloqueada; Dirección recostea y vuelve a estar lista', async ({ browser }) => {
    test.setTimeout(90_000);
    const nube = crearNubeFalsa({ usuarios: USUARIOS, preservaEconomia: 'vh035c' });
    const id = nube.sembrarFila({ usuario: 'ventas@vh.mx', cliente: 'Tradeco', partidas: [{ ...PARTIDA_CON_ECONOMIA, medidas: '120x60x75' }], total: 55680, piezas: 1 });
    const { ctx, page } = await abrirComo(browser, nube, 'ventas@vh.mx');
    await verificar(page).click();
    await expect(page.getByText(/Lista para emitir/)).toBeVisible({ timeout: 15000 });

    // Su otro dispositivo GUARDA el mismo renglón (mismo id, mismo material) con otro nombre y medidas.
    const seg = await rpcDesdeNavegador(page, 'ventas@vh.mx', 'cotizacion_segura', { p_id: id });
    const partidas = seg.json.partidas.map((p) => ({ ...p, nombre: 'Banca NOGAL MACIZO 12 usuarios', medidas: '360x160x75' }));
    const r = await rpcDesdeNavegador(page, 'ventas@vh.mx', 'actualizar_cotizacion_segura', { p_cotizacion_id: id, p_patch: { partidas } });
    expect(r.status).toBe(200);
    expect(r.json.partidas[0]).not.toHaveProperty('cost_stale');            // la marca es economía: el vendedor no la ve
    const p1 = nube.filas.get(id).partidas[0];
    expect(p1).not.toHaveProperty('costoUnitario');                         // el costo de la Banca de 6 no se re-pega
    expect(p1.cost_status).toBe('UNKNOWN');
    expect(p1.cost_stale).toMatchObject({ motivo: 'RECOSTEO_DEFINICION_CAMBIADA', campos: ['medidas', 'nombre'] });
    expect(p1.cost_stale.economia_previa).toMatchObject({ costoUnitario: 21000, margen: 30 });
    await ctx.close();

    const { ctx: ctx2, page: v } = await abrirComo(browser, nube, 'ventas@vh.mx');
    await verificar(v).click();
    await expect(v.getByText(/Faltan datos para cotizar/)).toBeVisible({ timeout: 15000 });
    await expect(v.getByText(/Línea 1: cambió su descripción, medidas u otra especificación; su costo anterior ya no vale/)).toBeVisible();
    await expect(v.getByText(/recosteo_pendiente_|definicion_cambiada/)).toHaveCount(0);
    await botonPDF(v).click();
    await expect(v.locator('.aviso.rojo', { hasText: /BORRADOR · NO REGISTRADO/ })).toBeVisible({ timeout: 20000 });
    expect(nube.revisiones).toHaveLength(0);
    expect(nube.llamadas.some((l) => l.includes('/rpc/emitir_revision'))).toBe(false);
    await ctx2.close();

    // Dirección recostea el mueble nuevo (quita la marca y pone su costo) → la compuerta vuelve a dejar emitir.
    const fila = nube.filas.get(id);
    fila.partidas = fila.partidas.map(({ cost_stale, ...p }) => ({ ...p, costoUnitario: 26000, margen: 32, cost_status: 'KNOWN' }));
    const { ctx: cd, page: d } = await abrirComo(browser, nube, 'rodrigo@vh.mx');
    await verificar(d).click();
    await expect(d.getByText(/Lista para emitir/)).toBeVisible({ timeout: 15000 });
    await cd.close();
  });

  test('sin falso positivo de DEFINICIÓN desde la interfaz: el vendedor sube la cantidad de un mueble SIN costo por lote con "+" → el costo de Dirección se conserva y sigue lista para emitir', async ({ browser }) => {
    const nube = crearNubeFalsa({ usuarios: USUARIOS, preservaEconomia: 'vh035c' });
    const id = nube.sembrarFila({ usuario: 'ventas@vh.mx', cliente: 'Tradeco', partidas: [PARTIDA_CON_ECONOMIA], total: 55680, piezas: 1 });
    const { ctx, page } = await abrirComo(browser, nube, 'ventas@vh.mx');
    await page.getByRole('button', { name: /^(\+|Más)$/ }).locator('visible=true').first().click();
    await esperarGuardado(nube, (n) => n.filas.get(id).partidas[0].cantidad === 2);
    const p1 = nube.filas.get(id).partidas[0];
    expect(p1).toMatchObject({ cantidad: 2, costoUnitario: 21000, margen: 30, cost_status: 'KNOWN' });
    expect(p1).not.toHaveProperty('cost_stale');
    await verificar(page).click();
    await expect(page.getByText(/Lista para emitir/)).toBeVisible({ timeout: 15000 });
    await ctx.close();
  });

  test('STALE desde la interfaz: el vendedor sube la cantidad de un mueble costeado por lote → recosteo pendiente, emisión bloqueada', async ({ browser }) => {
    const nube = crearNubeFalsa({ usuarios: USUARIOS, preservaEconomia: 'vh035c' });
    const LOTE = { id: 'p3', nombre: 'Credenza a medida', cantidad: 2, precioUnitario: 12000, costoUnitario: 6100, margen: 40, costo_por_lote: true, config: { costeo: { costoLote: 12200, costoUnitario: 6100, lote: 2 } } };
    const id = nube.sembrarFila({ usuario: 'ventas@vh.mx', cliente: 'Lote SA', partidas: [LOTE], total: 27840, piezas: 2 });
    const { ctx, page } = await abrirComo(browser, nube, 'ventas@vh.mx');
    expect((await leerLocal(page)).cotizacion.partidas[0]).not.toHaveProperty('costo_por_lote');   // la marca es economía: invisible

    await page.getByRole('button', { name: /^(\+|Más)$/ }).locator('visible=true').first().click();
    await esperarGuardado(nube, (n) => n.filas.get(id).partidas[0].cantidad === 3);
    const p3 = nube.filas.get(id).partidas[0];
    expect(p3).not.toHaveProperty('costoUnitario');                         // el costo del lote de 2 no se hereda al de 3
    expect(p3.cost_status).toBe('UNKNOWN');
    expect(p3.cost_stale).toMatchObject({ motivo: 'RECOSTEO_LOTE_CAMBIADO', campos: ['cantidad'], previo: { cantidad: 2 } });
    expect(p3.cost_stale.economia_previa).toMatchObject({ costoUnitario: 6100, costo_por_lote: true, config: { costeo: { costoLote: 12200 } } });

    await verificar(page).click();
    await expect(page.getByText(/Faltan datos para cotizar/)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/Línea 1: cambió la cantidad y su costo depende del lote; su costo anterior ya no vale/)).toBeVisible();
    await expect(page.getByText(/recosteo_pendiente_/)).toHaveCount(0);
    expect(nube.revisiones).toHaveLength(0);
    await ctx.close();
  });
});
