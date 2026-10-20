// ============================================================================
//  ÁREA J (Dirección) · RESILIENCIA — PRUEBAS ADVERSARIALES CON SIMULADOR.
//
//  ⚠️ ESTO NO ES CERTIFICACIÓN E2E REAL. Todo corre contra la NUBE FALSA (e2e/nubeFalsa.js,
//  espejo JS de las RPC de producción) y las fallas se inyectan con rutas de Playwright. Prueban
//  cómo REACCIONA el cliente (navegador real, Chromium) ante red lenta, timeouts, IA rota, recargas,
//  doble clic, sesión expirada, concurrencia y operaciones prohibidas; NO prueban el servidor real.
//  Lo que aquí se asegure del servidor es lo que el simulador imita (ver docs/auditoria/
//  VH035_SQL_VS_MOCK.md). Nada toca producción: el instalador de fallas NUNCA hace
//  `route.continue()`/`route.fetch()` hacia el host de Supabase; lo que no imita la nube falsa
//  se aborta.
//
//  Criterio (Dirección): "Ningún error puede provocar pérdida silenciosa de información económica o
//  técnica; toda operación prohibida debe fallar de forma segura." Cada escenario afirma lo que VE la
//  persona y lo que queda en los DATOS (nube falsa + estado local): nada se pierde, nada se inventa.
//  Los defectos reales quedan como `test.fail` con su severidad (no se debilita la aserción).
//  Tiempos: cada escenario imprime una línea `RESILIENCIA_TIEMPOS {json}` para el informe de
//  rendimiento (docs/auditoria/RESILIENCIA_10.md).
//
//  DEFECTOS que estas pruebas encontraron (detalle y evidencia en docs/auditoria/RESILIENCIA_10.md):
//   R-01 P2  sin "Guardando…" con la red lenta ............................ corregido (App.jsx)
//   R-02 P2  errores de IA en jerga de librería ("non-2xx", "Failed to send…") corregido (datos/erroresEdge.js)
//   R-03 P1  IA "ok" con piezas vacías/basura borraba el despiece ........... corregido (Costeador.jsx, mapIaComps.js)
//   R-04 P1  respuesta de creación perdida + edición = cotización duplicada . corregido (datos/cotizaciones.js)
//   R-05 P1  recargar a media captura borraba el Costeo manual en silencio .. corregido (datos/borradorCosteo.js)
//   R-06 P2  doble clic en "Agregar" metía dos partidas ..................... corregido (datos/dobleClic.js)
//   R-07 P1  sesión vencida ('no autorizado') = silencio + cotización duplicada corregido (cotizaciones.js, App.jsx)
//   R-08 P1  sin VH-148, la pestaña que vuelve offline pisa campos ajenos ... ABIERTO → test.fail (7c)
//   R-09 P2  al volver la red no se reintentaba hasta la siguiente edición .. corregido (App.jsx)
// ============================================================================
import { test, expect } from '@playwright/test';
import { crearNubeFalsa, estadoLocal, CLAVE_LOCAL, HOST, tokenDe } from './nubeFalsa.js';

const USUARIOS = { 'ventas@vh.mx': 'vendedor', 'rodrigo@vh.mx': 'direccion' };
const PASS = 'prueba-123';
const FLAG = 'vh:controlOptimista';
const PARTIDA = { id: 'p1', nombre: 'Banca APP LT 6 usuarios', cantidad: 1, precioUnitario: 48000 };
const SANA = { ...PARTIDA, costoUnitario: 21000, margen: 30, costoDerivado: false };

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
//  INSTALADOR DE FALLAS. Envuelve el manejador de la nube falsa (sin tocar nubeFalsa.js) para
//  inyectar, por regla: latencia ANTES de que el "servidor" reciba (`antes`), latencia DESPUÉS de
//  que escribió (`despues`: el servidor ya confirmó, la respuesta tarda), respuesta sustituida
//  (`responder`), corte de red (`abortar`) o "escribió pero la respuesta se perdió"
//  (`confirmaYCorta`). Cada regla tiene `veces` (default ∞) y se puede retirar.
// ---------------------------------------------------------------------------
async function instalarConFallas(context, nube) {
  let manejar = null;
  nube.instalar({ route: (_patron, h) => { manejar = h; } });   // sólo captura el manejador
  const reglas = [];
  const vistos = [];   // { ruta, metodo, body, t }
  await context.route(`${HOST}/**`, async (route) => {
    const req = route.request();
    const ruta = new URL(req.url()).pathname;
    let body = null; try { body = req.postDataJSON(); } catch { body = null; }
    vistos.push({ ruta, metodo: req.method(), body, t: Date.now() });
    const r = reglas.find((x) => x.activa && x.veces > 0 && x.coincide(ruta, req, body));
    if (!r) return manejar(conRed(route));
    r.veces -= 1; r.usos += 1;
    return r.accion(route, { ruta, body, uso: r.usos });
  });
  // El servidor de desarrollo puede apuntar a las copias RC de las Edge (VITE_*_FN=…-rc, sólo en DEV).
  // La nube falsa conoce los nombres de producción: se normaliza `/functions/v1/<fn>-rc` → `<fn>`.
  const sinRc = (req) => new Proxy(req, {
    get(t, k) {
      if (k === 'url') return () => t.url().replace(/(\/functions\/v1\/[a-z-]+?)-rc(?=[/?]|$)/, '$1');
      const v = t[k]; return typeof v === 'function' ? v.bind(t) : v;
    },
  });
  // Nunca se deja pasar nada a la red real: `continue` sobre el host de Supabase = abortar.
  const conRed = (route, { demora = 0, cortar = false } = {}) => new Proxy(route, {
    get(t, k) {
      if (k === 'continue' || k === 'fetch') return async () => t.abort('blockedbyclient');
      if (k === 'fulfill') return async (o) => { if (demora) await esperar(demora); if (cortar) return t.abort('connectionreset').catch(() => {}); return t.fulfill(o).catch(() => {}); };
      if (k === 'request') return () => sinRc(t.request());
      const v = t[k]; return typeof v === 'function' ? v.bind(t) : v;
    },
  });
  const api = {
    vistos,
    regla(coincide, accion, { veces = Infinity } = {}) { const r = { coincide, accion, veces, usos: 0, activa: true }; reglas.push(r); return { retirar() { r.activa = false; }, get usos() { return r.usos; } }; },
    // latencia antes de que el servidor lo reciba
    antes: (ms) => async (route) => { await esperar(ms); return manejar(conRed(route)); },
    // el servidor escribe YA; la respuesta llega `ms` después
    despues: (ms) => async (route) => manejar(conRed(route, { demora: ms })),
    // el servidor escribe y la conexión se corta antes de que llegue la respuesta
    confirmaYCorta: (ms = 0) => async (route) => manejar(conRed(route, { demora: ms, cortar: true })),
    responder: (status, cuerpo, { demora = 0, tipo = 'application/json' } = {}) => async (route) => {
      if (demora) await esperar(demora);
      return route.fulfill({ status, contentType: tipo, body: typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo) }).catch(() => {});
    },
    abortar: (codigo = 'timedout', { demora = 0 } = {}) => async (route) => { if (demora) await esperar(demora); return route.abort(codigo).catch(() => {}); },
    rpc: (fn) => (ruta) => ruta === `/rest/v1/rpc/${fn}`,
    edge: (fn) => (ruta) => ruta === `/functions/v1/${fn}` || ruta === `/functions/v1/${fn}-rc`,
  };
  return api;
}

async function contexto(browser, nube, { estado = estadoLocal(), flag = false, opciones = {} } = {}) {
  const context = await browser.newContext(opciones);
  const fallas = await instalarConFallas(context, nube);
  await context.addInitScript(({ k, v, flag, fk }) => {
    if (!localStorage.getItem('__sembrado__')) { localStorage.setItem(k, JSON.stringify(v)); localStorage.setItem('__sembrado__', '1'); }
    if (flag) localStorage.setItem(fk, '1');
  }, { k: CLAVE_LOCAL, v: estado, flag, fk: FLAG });
  const page = await context.newPage();
  return { context, page, fallas };
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
const leerLocal = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '{}'), CLAVE_LOCAL);
const estadoNube = (page) => page.getByTestId('nube-estado');
const toast = (page) => page.locator('.toast');
async function irACotizacion(page) {
  await page.getByRole('button', { name: /Mi cotización/i }).first().click();
  await expect(inputCliente(page)).toBeVisible({ timeout: 10000 });
}
async function abrirPrimeraDelArchivo(page) {
  await page.getByText('Más herramientas').click();
  await page.getByRole('button', { name: /^Presupuestos anteriores/ }).click();
  await expect(page.getByTestId('respaldo-local')).toBeVisible({ timeout: 10000 });
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: /^Abrir$/ }).first().click();
  await expect(inputCliente(page)).toBeVisible({ timeout: 10000 });
}
const esperarNube = async (nube, cond, ms = 10000) => expect.poll(() => cond(nube), { timeout: ms }).toBe(true);
const llamadasA = (nube, fn) => nube.llamadas.filter((l) => l.includes(`/rest/v1/rpc/${fn}`)).length;
function tiempos(escenario) {
  const t0 = Date.now(); const marcas = {};
  return {
    marca(n) { marcas[n] = Date.now() - t0; return marcas[n]; },
    imprimir(extra = {}) { console.log(`RESILIENCIA_TIEMPOS ${JSON.stringify({ escenario, total_ms: Date.now() - t0, ...marcas, ...extra })}`); },
  };
}

// ============================================================================
//  1 · RED LENTA (8–15 s) al guardar la cotización
// ============================================================================
test.describe('1 · Red lenta al guardar', () => {
  test('latencia de 10 s en actualizar: no duplica, el dato queda, la nube no "inventa" un guardado antes de tiempo', async ({ browser }) => {
    test.setTimeout(90_000);
    const T = tiempos('1a_red_lenta_guardar');
    const nube = crearNubeFalsa({ usuarios: USUARIOS });
    const { context, page, fallas } = await contexto(browser, nube, { estado: estadoLocal({ cotizacion: { cliente: 'Lenta SA', partidas: [PARTIDA] } }) });
    await entrar(page, 'ventas@vh.mx');
    await esperarNube(nube, (n) => n.filas.size === 1);
    const id = [...nube.filas.keys()][0];
    await expect.poll(async () => (await leerLocal(page)).cotizacion?.id).toBe(id);
    T.marca('creada');
    fallas.regla(fallas.rpc('actualizar_cotizacion_segura'), fallas.antes(10_000));
    await irACotizacion(page);
    const tEdit = Date.now();
    await inputCliente(page).fill('Lenta SA Norte');
    // Durante el vuelo: lo local ya lo tiene, la nube todavía no, y NADA se duplica.
    await esperar(4000);
    expect((await leerLocal(page)).cotizacion.cliente).toBe('Lenta SA Norte');
    expect(nube.filas.get(id).cliente).toBe('Lenta SA');
    expect(nube.creates).toBe(1);
    await esperarNube(nube, (n) => n.filas.get(id).cliente === 'Lenta SA Norte', 20_000);
    const guardadoMs = T.marca('guardado_tras_latencia');
    const latenciaPercibida = Date.now() - tEdit;
    await expect(estadoNube(page)).toHaveAttribute('data-estado', 'conectado');
    await esperar(2500);
    expect(nube.filas.size).toBe(1);
    expect(nube.creates).toBe(1);
    expect(nube.updates).toBe(1);
    await expect(page.locator('.toast', { hasText: /No se pudo guardar/i })).toHaveCount(0);
    T.imprimir({ latencia_inyectada_ms: 10000, edicion_a_guardado_ms: latenciaPercibida, guardadoMs });
    await context.close();
  });

  // R-01 (P2, UX · CORREGIDO en src/App.jsx): no existía estado "Guardando…": durante 10–12 s el punto del
  // encabezado decía "En línea" (data-estado="conectado") aunque el cambio todavía no llegaba a la nube. Si la
  // persona cerraba la pestaña en ese lapso, creía que quedó guardado (lo local sí está; la nube no).
  test('la interfaz indica "Guardando…" mientras la escritura está en vuelo', async ({ browser }) => {
    test.setTimeout(90_000);
    const T = tiempos('1b_indicador_guardando');
    const nube = crearNubeFalsa({ usuarios: USUARIOS });
    const { context, page, fallas } = await contexto(browser, nube, { estado: estadoLocal({ cotizacion: { cliente: 'Lenta SA', partidas: [PARTIDA] } }) });
    await entrar(page, 'ventas@vh.mx');
    await esperarNube(nube, (n) => n.filas.size === 1);
    fallas.regla(fallas.rpc('actualizar_cotizacion_segura'), fallas.antes(12_000));
    await irACotizacion(page);
    await inputCliente(page).fill('Lenta SA Sur');
    await expect(estadoNube(page)).toHaveAttribute('data-guardando', '1', { timeout: 5000 });
    await expect(estadoNube(page)).toHaveAttribute('title', /Guardando en la nube/);
    T.marca('indicador_visible');
    await expect(estadoNube(page)).toHaveAttribute('data-guardando', '0', { timeout: 20000 });
    T.marca('indicador_apagado');
    await expect(estadoNube(page)).toHaveAttribute('data-estado', 'conectado');
    T.imprimir({ latencia_inyectada_ms: 12000 });
    await context.close();
  });

  test('respuestas fuera de orden (la vieja llega 12 s tarde): la nube termina con lo ÚLTIMO que escribió la persona', async ({ browser }) => {
    test.setTimeout(90_000);
    const T = tiempos('1c_respuestas_fuera_de_orden');
    const nube = crearNubeFalsa({ usuarios: USUARIOS });
    const { context, page, fallas } = await contexto(browser, nube, { estado: estadoLocal({ cotizacion: { cliente: 'Orden SA', partidas: [PARTIDA] } }) });
    await entrar(page, 'ventas@vh.mx');
    await esperarNube(nube, (n) => n.filas.size === 1);
    const id = [...nube.filas.keys()][0];
    // 1er guardado: llega al servidor 12 s tarde. 2º: 1 s. El servidor recibe 2º y LUEGO el 1º (viejo).
    fallas.regla(fallas.rpc('actualizar_cotizacion_segura'), async (route, { uso }) => fallas.antes(uso === 1 ? 12_000 : 1000)(route), { veces: 2 });
    await irACotizacion(page);
    await inputCliente(page).fill('Orden SA v1');
    await esperar(2500);   // dispara el 1er autosave
    await inputCliente(page).fill('Orden SA v2');
    await esperarNube(nube, (n) => n.filas.get(id).cliente === 'Orden SA v2', 10_000);
    T.marca('v2_en_nube');
    await esperarNube(nube, (n) => n.updates >= 2, 20_000);   // llegó el viejo
    T.marca('llego_el_viejo');
    // Lo que importa: tras asentarse, la nube tiene lo último de la persona.
    await esperarNube(nube, (n) => n.filas.get(id).cliente === 'Orden SA v2', 15_000);
    T.marca('autocorregido');
    expect((await leerLocal(page)).cotizacion.cliente).toBe('Orden SA v2');
    expect(nube.filas.size).toBe(1);
    T.imprimir({ updates: nube.updates });
    await context.close();
  });
});

// ============================================================================
//  2 · TIMEOUT / 504 de una Edge de IA  ·  3 · IA responde basura
// ============================================================================
const PREVIA = { id: 'prev-1', nombre: 'Silla previa ya cotizada', cantidad: 3, precioUnitario: 5200 };
const PEDIDO = '2 escritorios de 1.50, una cabina acústica y una credenza';
const cajaPedido = (page) => page.locator('textarea.ia-textarea').first();
const botonArmar = (page) => page.getByRole('button', { name: /Armar la lista de muebles|Volver a interpretar/ });
const alertaIA = (page) => page.locator('.alerta.roja').first();
// Lo que la persona NO debe leer en un error: jerga de la librería o del navegador.
const JERGA = /non-2xx|Edge Function|Failed to fetch|Unexpected token|JSON|is not a function|undefined|TypeError|SyntaxError/i;

async function abrirCotizarIA(browser, nube, { conPrevia = true } = {}) {
  const c = await contexto(browser, nube, { estado: estadoLocal({ cotizacion: { cliente: 'Previo SA', partidas: conPrevia ? [PREVIA] : [] } }) });
  await entrar(c.page, 'ventas@vh.mx');
  await c.page.getByText('Más herramientas').click();
  await c.page.getByRole('button', { name: /^Cotizar varios con IA/ }).click();
  await expect(cajaPedido(c.page)).toBeVisible({ timeout: 10000 });
  await cajaPedido(c.page).fill(PEDIDO);
  return c;
}
const partidasLocales = async (page) => (await leerLocal(page)).cotizacion?.partidas || [];

async function abrirCosteoManual(browser, nube) {
  const c = await contexto(browser, nube);
  await entrar(c.page, 'rodrigo@vh.mx');
  await c.page.getByText('Más herramientas').click();
  await c.page.getByRole('button', { name: /^Costeo manual/ }).click();
  await expect(c.page.locator('#desc-voni')).toBeVisible({ timeout: 10000 });
  await c.page.fill('#desc-voni', 'Mesa de juntas de MDF 16 mm para 8 personas');
  c.page.on('dialog', (d) => d.accept());   // "Esto reemplazará las piezas actuales…": la persona acepta
  return c;
}
const piezasBOM = (page) => page.locator('.pieza-nom').evaluateAll((els) => els.map((e) => e.value));
const botonAnalizar = (page) => page.getByRole('button', { name: /Analizar con Voni/ });
// El aviso de Voni (errIA) vive en la tarjeta de la descripción; otros .alerta.roja (bloqueos de estructura) no cuentan.
const errorCosteo = (page) => page.locator('.tarjeta').filter({ has: page.locator('#desc-voni') }).locator('> .alerta.roja');

// R-02 (P2 · CORREGIDO): antes el vendedor leía "Edge Function returned a non-2xx status code" (504),
// "Failed to send a request to the Edge Function" (corte) o "Unterminated string in JSON at position 55" (JSON truncado).
// R-03 (P1 · CORREGIDO): analizar-mueble con `ok:true` y `piezas: []` reemplazaba el despiece por uno VACÍO sin decir
// nada; con `piezas` en texto se leía "((intermediate value) || []).map is not a function".
test.describe('2 · Timeout / 504 de la IA', () => {
  test('cotizar-texto: 504 tras 9 s → mensaje comprensible, el pedido y lo ya cotizado siguen, reintentar funciona', async ({ browser }) => {
    test.setTimeout(90_000);
    const T = tiempos('2a_cotizar_texto_504');
    const nube = crearNubeFalsa({ usuarios: USUARIOS });
    const { context, page, fallas } = await abrirCotizarIA(browser, nube);
    const antes = await partidasLocales(page);
    fallas.regla(fallas.edge('cotizar-texto'), fallas.responder(504, 'upstream request timeout', { demora: 9000, tipo: 'text/plain' }), { veces: 1 });
    const t0 = Date.now();
    await botonArmar(page).click();
    await expect(page.getByText(/Voni está trabajando/)).toBeVisible({ timeout: 5000 });   // se ve que está trabajando
    await expect(alertaIA(page)).toBeVisible({ timeout: 20000 });
    const msErr = Date.now() - t0;
    const texto = await alertaIA(page).innerText();
    expect(texto, 'el mensaje no es jerga técnica').not.toMatch(JERGA);
    expect(texto, 'dice que se puede reintentar').toMatch(/intent/i);
    await expect(cajaPedido(page)).toHaveValue(PEDIDO);                       // el pedido no se borró
    expect(await partidasLocales(page)).toEqual(antes);                        // lo ya cotizado sigue intacto
    // reintento (la edge ya contesta)
    await botonArmar(page).click();
    await expect(page.getByText(/Agregué 1 mueble/)).toBeVisible({ timeout: 20000 });
    const ps = await partidasLocales(page);
    expect(ps).toHaveLength(2);
    expect(ps[0]).toMatchObject(PREVIA);
    T.imprimir({ latencia_inyectada_ms: 9000, clic_a_mensaje_ms: msErr, mensaje: texto });
    await context.close();
  });

  test('cotizar-texto: la red corta por tiempo agotado → mensaje comprensible y nada cambia', async ({ browser }) => {
    test.setTimeout(60_000);
    const T = tiempos('2b_cotizar_texto_timeout_red');
    const nube = crearNubeFalsa({ usuarios: USUARIOS });
    const { context, page, fallas } = await abrirCotizarIA(browser, nube);
    const antes = await partidasLocales(page);
    fallas.regla(fallas.edge('cotizar-texto'), fallas.abortar('timedout', { demora: 8000 }), { veces: 1 });
    await botonArmar(page).click();
    await expect(alertaIA(page)).toBeVisible({ timeout: 20000 });
    T.marca('aviso');
    const texto = await alertaIA(page).innerText();
    expect(texto).not.toMatch(JERGA);
    expect(texto).toMatch(/intent/i);
    expect(await partidasLocales(page)).toEqual(antes);
    await expect(cajaPedido(page)).toHaveValue(PEDIDO);
    T.imprimir({ latencia_inyectada_ms: 8000, mensaje: texto });
    await context.close();
  });

  test('analizar-mueble: 504 tras 8 s → el despiece previo NO se toca, mensaje comprensible, reintentar funciona', async ({ browser }) => {
    test.setTimeout(90_000);
    const T = tiempos('2c_analizar_mueble_504');
    const nube = crearNubeFalsa({ usuarios: USUARIOS });
    const { context, page, fallas } = await abrirCosteoManual(browser, nube);
    await botonAnalizar(page).click();
    await expect.poll(() => piezasBOM(page), { timeout: 15000 }).toContain('Cubierta');
    const bom = await piezasBOM(page);
    const desc = await page.locator('#desc-voni').inputValue();
    T.marca('primer_analisis_ok');
    fallas.regla(fallas.edge('analizar-mueble'), fallas.responder(504, 'upstream request timeout', { demora: 8000, tipo: 'text/plain' }), { veces: 1 });
    const t0 = Date.now();
    await botonAnalizar(page).click();
    await expect(page.getByRole('button', { name: /Voni está entendiendo/ })).toBeVisible({ timeout: 5000 });
    await expect(errorCosteo(page)).toBeVisible({ timeout: 20000 });
    const msErr = Date.now() - t0;
    const texto = await errorCosteo(page).innerText();
    expect(texto).not.toMatch(JERGA);
    expect(await piezasBOM(page), 'el despiece técnico previo sigue igual').toEqual(bom);
    await expect(page.locator('#desc-voni')).toHaveValue(desc);   // la descripción técnica no se borró
    await botonAnalizar(page).click();
    await expect(errorCosteo(page)).toBeHidden({ timeout: 15000 });
    await expect.poll(() => piezasBOM(page)).toContain('Cubierta');
    T.imprimir({ latencia_inyectada_ms: 8000, clic_a_mensaje_ms: msErr, mensaje: texto });
    await context.close();
  });
});

test.describe('3 · La IA responde basura', () => {
  test('cotizar-texto: JSON truncado → no entra nada, se dice en palabras normales', async ({ browser }) => {
    test.setTimeout(60_000);
    const T = tiempos('3a_cotizar_texto_json_truncado');
    const nube = crearNubeFalsa({ usuarios: USUARIOS });
    const { context, page, fallas } = await abrirCotizarIA(browser, nube);
    const antes = await partidasLocales(page);
    fallas.regla(fallas.edge('cotizar-texto'), fallas.responder(200, '{"ok":true,"propuesta":{"items":[{"ruta":"applt","produ'), { veces: 1 });
    await botonArmar(page).click();
    await expect(alertaIA(page)).toBeVisible({ timeout: 15000 });
    T.marca('aviso');
    const texto = await alertaIA(page).innerText();
    expect(await partidasLocales(page)).toEqual(antes);
    expect(texto, 'mensaje comprensible').not.toMatch(JERGA);
    T.imprimir({ mensaje: texto });
    await context.close();
  });

  test('cotizar-texto: forma inválida (items no es lista, renglones sin producto) → no entra basura ni $0, se dice', async ({ browser }) => {
    test.setTimeout(60_000);
    const T = tiempos('3b_cotizar_texto_forma_invalida');
    const nube = crearNubeFalsa({ usuarios: USUARIOS });
    const { context, page, fallas } = await abrirCotizarIA(browser, nube);
    const antes = await partidasLocales(page);
    fallas.regla(fallas.edge('cotizar-texto'), fallas.responder(200, { ok: true, propuesta: { items: 'basura', banco: 5, preguntas: 'no es lista', resumen: '', noEncontrado: null } }), { veces: 1 });
    await botonArmar(page).click();
    await expect(page.getByText(/No pude armar ningún mueble/)).toBeVisible({ timeout: 15000 });
    expect(await partidasLocales(page)).toEqual(antes);
    // renglones sin producto/cantidad absurda
    nube.cotizacionIA = { ok: true, propuesta: { items: [{ ruta: null, producto: null, cantidad: 'muchos', seleccion: 'x', etiqueta: 'Cosa rara' }, { cantidad: -5 }], banco: [], preguntas: [], resumen: '', noEncontrado: [] } };
    await botonArmar(page).click();
    await expect(page.getByText(/No pude costear: Cosa rara/)).toBeVisible({ timeout: 15000 });
    const ps = await partidasLocales(page);
    expect(ps).toEqual(antes);
    for (const p of ps) expect(Number(p.precioUnitario) > 0).toBe(true);
    T.imprimir();
    await context.close();
  });

  test('analizar-mueble: ok:false INVALID_MODEL_SHAPE → se dice y el despiece no cambia', async ({ browser }) => {
    test.setTimeout(60_000);
    const T = tiempos('3c_analizar_invalid_model_shape');
    const nube = crearNubeFalsa({ usuarios: USUARIOS });
    const { context, page, fallas } = await abrirCosteoManual(browser, nube);
    await botonAnalizar(page).click();
    await expect.poll(() => piezasBOM(page), { timeout: 15000 }).toContain('Cubierta');
    const bom = await piezasBOM(page);
    fallas.regla(fallas.edge('analizar-mueble'), fallas.responder(200, { ok: false, code: 'INVALID_MODEL_SHAPE', error: 'La IA devolvió un despiece sin forma válida. Reintenta.', request_id: 'req-x' }), { veces: 1 });
    await botonAnalizar(page).click();
    await expect(errorCosteo(page)).toContainText(/sin forma válida/, { timeout: 15000 });
    T.marca('aviso');
    expect(await piezasBOM(page)).toEqual(bom);
    T.imprimir();
    await context.close();
  });

  test('analizar-mueble: ok:true con piezas vacías → NO reemplaza el despiece por uno vacío; se dice', async ({ browser }) => {
    test.setTimeout(60_000);
    const T = tiempos('3d_analizar_piezas_vacias');
    const nube = crearNubeFalsa({ usuarios: USUARIOS });
    const { context, page, fallas } = await abrirCosteoManual(browser, nube);
    await botonAnalizar(page).click();
    await expect.poll(() => piezasBOM(page), { timeout: 15000 }).toContain('Cubierta');
    const bom = await piezasBOM(page);
    fallas.regla(fallas.edge('analizar-mueble'), fallas.responder(200, { ok: true, request_id: 'req-v', catalogoFuente: 'canonico', propuesta: { producto: 'Mesa', piezas: [], preguntas: [] } }), { veces: 1 });
    await botonAnalizar(page).click();
    await expect(errorCosteo(page)).toBeVisible({ timeout: 15000 });
    T.marca('aviso');
    expect(await piezasBOM(page)).toEqual(bom);
    expect(await errorCosteo(page).innerText()).not.toMatch(JERGA);
    T.imprimir();
    await context.close();
  });

  test('analizar-mueble: piezas como texto (no lista) → NO entra basura; mensaje comprensible', async ({ browser }) => {
    test.setTimeout(60_000);
    const T = tiempos('3e_analizar_piezas_texto');
    const nube = crearNubeFalsa({ usuarios: USUARIOS });
    const { context, page, fallas } = await abrirCosteoManual(browser, nube);
    await botonAnalizar(page).click();
    await expect.poll(() => piezasBOM(page), { timeout: 15000 }).toContain('Cubierta');
    const bom = await piezasBOM(page);
    fallas.regla(fallas.edge('analizar-mueble'), fallas.responder(200, { ok: true, request_id: 'req-t', propuesta: { producto: 'Mesa', piezas: '[{"nombre":"Cubierta"}]' } }), { veces: 1 });
    await botonAnalizar(page).click();
    await expect(errorCosteo(page)).toBeVisible({ timeout: 15000 });
    expect(await piezasBOM(page)).toEqual(bom);
    expect(await errorCosteo(page).innerText()).not.toMatch(JERGA);
    T.imprimir();
    await context.close();
  });
});

// ============================================================================
//  4 · RECARGA a mitad de edición (con cambios sin guardar en la nube)
// ============================================================================
test.describe('4 · Recarga a mitad de edición', () => {
  test('cotización: recargar antes de que el autosave salga (y con la red lenta) recupera lo escrito y lo guarda en LA MISMA fila', async ({ browser }) => {
    test.setTimeout(90_000);
    const T = tiempos('4a_recarga_cotizacion');
    const nube = crearNubeFalsa({ usuarios: USUARIOS });
    const { context, page, fallas } = await contexto(browser, nube, { estado: estadoLocal({ cotizacion: { cliente: 'Recarga SA', partidas: [PARTIDA] } }) });
    await entrar(page, 'ventas@vh.mx');
    await esperarNube(nube, (n) => n.filas.size === 1);
    const id = [...nube.filas.keys()][0];
    await expect.poll(async () => (await leerLocal(page)).cotizacion?.id).toBe(id);
    fallas.regla(fallas.rpc('actualizar_cotizacion_segura'), fallas.antes(8000));
    await irACotizacion(page);
    await inputCliente(page).fill('Recarga SA Planta 2');
    await inputFolio(page).fill('RC-77');
    await esperar(300);            // antes de los 1.5 s del autosave: nada salió a la nube
    expect(llamadasA(nube, 'actualizar_cotizacion_segura')).toBe(0);
    const tR = Date.now();
    await page.reload();
    await expect(page.getByRole('button', { name: /Salir/i }).first()).toBeVisible({ timeout: 45000 });
    T.marca('recargada');
    const local = await leerLocal(page);
    expect(local.cotizacion).toMatchObject({ id, cliente: 'Recarga SA Planta 2', folio: 'RC-77' });   // nada se perdió
    await esperarNube(nube, (n) => n.filas.get(id).cliente === 'Recarga SA Planta 2' && n.filas.get(id).folio === 'RC-77', 25_000);
    const msNube = Date.now() - tR;
    expect(nube.filas.size).toBe(1);
    expect(nube.creates).toBe(1);
    await irACotizacion(page);
    await expect(inputCliente(page)).toHaveValue('Recarga SA Planta 2');
    T.imprimir({ recarga_a_nube_ms: msNube, latencia_inyectada_ms: 8000 });
    await context.close();
  });

  test('primer guardado: el servidor creó la fila pero la respuesta se perdió; se recarga sin editar → sigue siendo UNA fila', async ({ browser }) => {
    test.setTimeout(90_000);
    const T = tiempos('4b_respuesta_perdida_y_recarga');
    const nube = crearNubeFalsa({ usuarios: USUARIOS });
    const { context, page, fallas } = await contexto(browser, nube, { estado: estadoLocal({ cotizacion: { cliente: 'Perdida SA', partidas: [PARTIDA] } }) });
    fallas.regla(fallas.rpc('crear_cotizacion_segura'), fallas.confirmaYCorta(1500), { veces: 1 });
    await entrar(page, 'ventas@vh.mx');
    await esperarNube(nube, (n) => n.filas.size === 1);
    await expect(estadoNube(page)).toHaveAttribute('data-estado', 'sin-conexion', { timeout: 10000 });   // se dijo
    const id = [...nube.filas.keys()][0];
    expect((await leerLocal(page)).cotizacion.id ?? null).toBeNull();   // el cliente no sabe que se creó
    await page.reload();
    await expect(page.getByRole('button', { name: /Salir/i }).first()).toBeVisible({ timeout: 45000 });
    await expect.poll(async () => (await leerLocal(page)).cotizacion?.id, { timeout: 15000 }).toBe(id);
    T.marca('reconciliada');
    await esperar(2500);
    expect(nube.filas.size).toBe(1);
    T.imprimir({ creates_intentados: llamadasA(nube, 'crear_cotizacion_segura') });
    await context.close();
  });

  // R-04 (P1 · duplicado, CORREGIDO en src/datos/cotizaciones.js · guardarCotizacion + vitest
  // cotizaciones.resiliencia.test.js): si el servidor CREÓ la fila pero la respuesta se perdió y la persona editaba
  // antes del reintento, el reintento llevaba la MISMA clave con OTRO contenido → 'idempotency key reused with
  // different payload' → el cliente ROTABA la clave → SEGUNDA fila huérfana (medido: filas 2, creates 2). Ahora
  // se reenvía primero exactamente lo que salió (idempotente) y luego se actualiza.
  test('primer guardado con respuesta perdida + edición → NO debe nacer una segunda cotización', async ({ browser }) => {
    test.setTimeout(90_000);
    const T = tiempos('4c_respuesta_perdida_y_edicion');
    const nube = crearNubeFalsa({ usuarios: USUARIOS });
    const { context, page, fallas } = await contexto(browser, nube, { estado: estadoLocal({ cotizacion: { cliente: 'Huerfana SA', partidas: [PARTIDA] } }) });
    fallas.regla(fallas.rpc('crear_cotizacion_segura'), fallas.confirmaYCorta(1500), { veces: 1 });
    await entrar(page, 'ventas@vh.mx');
    await esperarNube(nube, (n) => n.filas.size === 1);
    await expect(estadoNube(page)).toHaveAttribute('data-estado', 'sin-conexion', { timeout: 10000 });
    await irACotizacion(page);
    await inputCliente(page).fill('Huerfana SA Norte');
    await esperarNube(nube, (n) => [...n.filas.values()].some((f) => f.cliente === 'Huerfana SA Norte'), 15_000);
    await esperar(2500);
    T.marca('asentado');
    T.imprimir({ filas: nube.filas.size, creates: nube.creates });
    expect(nube.filas.size, 'una sola cotización en la nube').toBe(1);
    const [fila] = [...nube.filas.values()];
    expect(fila.cliente, 'con lo último que escribió la persona').toBe('Huerfana SA Norte');
    await expect.poll(async () => (await leerLocal(page)).cotizacion?.id).toBe(fila.id);
    await expect(estadoNube(page)).toHaveAttribute('data-estado', 'conectado');
    await context.close();
  });

  // R-05 (P1 · pérdida silenciosa de información técnica, CORREGIDO): el despiece del Costeo manual vivía sólo en
  // memoria (src/App.jsx `useState(costeoEnBlanco)`): medido 2 piezas antes de recargar, 0 después, ningún aviso.
  // Ahora se conserva como borrador en esta computadora (src/datos/borradorCosteo.js + vitest) y se avisa al volver.
  test('costeo manual: recargar a media captura recupera el despiece (o avisa); nunca lo pierde en silencio', async ({ browser }) => {
    test.setTimeout(90_000);
    const T = tiempos('4d_recarga_costeo_manual');
    const nube = crearNubeFalsa({ usuarios: USUARIOS });
    const { context, page } = await abrirCosteoManual(browser, nube);
    await botonAnalizar(page).click();
    await expect.poll(() => piezasBOM(page), { timeout: 15000 }).toContain('Cubierta');
    await page.locator('.pieza-nom').first().fill('Cubierta especial 1.20');
    await page.fill('#nom-pieza', 'Mesa de juntas Torre Norte');
    const bom = await piezasBOM(page);
    await esperar(500);
    await page.reload();
    await expect(page.getByRole('button', { name: /Salir/i }).first()).toBeVisible({ timeout: 45000 });
    T.marca('recargada');
    if (await page.getByRole('dialog', { name: /Guía de uso/i }).isVisible().catch(() => false)) await page.keyboard.press('Escape');
    await page.getByText('Más herramientas').click();
    await page.getByRole('button', { name: /^Costeo manual/ }).click();
    await expect(page.locator('#desc-voni')).toBeVisible({ timeout: 10000 });
    const recuperado = await piezasBOM(page);
    const aviso = await page.getByText(/recuper|se perdi|no se guard/i).count();
    T.imprimir({ piezas_antes: bom.length, piezas_despues: recuperado.length, aviso });
    expect(recuperado.length > 0 ? recuperado : aviso, 'o se recupera el despiece o se avisa').toBeTruthy();
    if (recuperado.length) {
      await expect(page.locator('.toast', { hasText: /Recuperé el costeo/ })).toBeVisible();   // y se DICE
      expect(recuperado).toEqual(bom);
      await expect(page.locator('#nom-pieza')).toHaveValue('Mesa de juntas Torre Norte');
    }
    await context.close();
  });
});

// ============================================================================
//  5 · DOBLE CLIC en "Agregar", "Guardar" y "Descargar PDF"
// ============================================================================
test.describe('5 · Doble clic', () => {
  // R-06 (P2 · CORREGIDO): medido antes del arreglo: 2 partidas idénticas por doble clic (5a y 5b), total duplicado.
  test('"Agregar →" de un artículo de línea con doble clic: entra UNA partida', async ({ browser }) => {
    test.setTimeout(60_000);
    const T = tiempos('5a_doble_clic_agregar_articulo');
    const nube = crearNubeFalsa({ usuarios: USUARIOS });
    const { context, page } = await contexto(browser, nube);
    await entrar(page, 'ventas@vh.mx');
    await page.getByText('Más herramientas').click();
    await page.getByRole('button', { name: /^Cotizar de línea/ }).click();
    await page.getByPlaceholder(/¿Qué mueble necesitas\?/).fill('ECARS86P');
    const hallado = page.locator('button.hallado', { hasText: /Agregar →/ }).first();
    await expect(hallado).toBeVisible({ timeout: 10000 });
    const t0 = Date.now();
    await hallado.dblclick();
    await esperar(1200);
    const ps = await partidasLocales(page);
    T.imprimir({ partidas: ps.length, clic_a_estado_ms: Date.now() - t0 });
    expect(ps.filter((p) => /ARCHIVERO DIRECTOR/.test(p.nombre || '')), 'una sola partida por un doble clic').toHaveLength(1);
    await context.close();
  });

  test('"Agregar a la cotización" (Cotizar de línea, configurable) con doble clic: entra UNA partida', async ({ browser }) => {
    test.setTimeout(60_000);
    const T = tiempos('5b_doble_clic_agregar_linea');
    const nube = crearNubeFalsa({ usuarios: USUARIOS });
    const { context, page } = await contexto(browser, nube);
    await entrar(page, 'rodrigo@vh.mx');
    await page.getByText('Más herramientas').click();
    await page.getByRole('button', { name: /^Cotizar de línea/ }).click();
    await page.getByPlaceholder(/¿Qué mueble necesitas\?/).fill('banca doble');
    await page.locator('button.hallado', { hasText: /Configurar →/ }).first().click();
    const agregar = page.getByRole('button', { name: /^Agregar a la cotización$/ });
    await expect(agregar).toBeEnabled({ timeout: 10000 });
    await agregar.dblclick();
    await esperar(1200);
    const ps = await partidasLocales(page);
    T.imprimir({ partidas: ps.length });
    expect(ps, 'una sola partida por un doble clic').toHaveLength(1);
    // Un segundo clic DELIBERADO (después de la ventana) sí agrega otra: el seguro no estorba el trabajo normal.
    await esperar(1200);
    await agregar.click();
    await expect.poll(async () => (await partidasLocales(page)).length).toBe(2);
    await context.close();
  });

  test('"Volver a aplicar mis cambios" (guardar explícito) con doble clic: UN guardado, sin segundo conflicto ni filas nuevas', async ({ browser }) => {
    test.setTimeout(120_000);
    const T = tiempos('5c_doble_clic_guardar');
    const nube = crearNubeFalsa({ usuarios: USUARIOS });
    const id = nube.sembrarFila({ usuario: 'ventas@vh.mx', cliente: 'Doble SA', partidas: [PARTIDA], total: 55680, piezas: 1 });
    const A = await contexto(browser, nube, { flag: true }); const B = await contexto(browser, nube, { flag: true });
    await entrar(A.page, 'ventas@vh.mx'); await abrirPrimeraDelArchivo(A.page);
    await entrar(B.page, 'ventas@vh.mx'); await abrirPrimeraDelArchivo(B.page);
    await inputCliente(A.page).fill('Doble SA Norte');
    await esperarNube(nube, (n) => n.filas.get(id).cliente === 'Doble SA Norte');
    await inputCliente(B.page).fill('Doble SA Sur');
    const banner = B.page.getByTestId('conflicto-guardado');
    await expect(banner).toBeVisible({ timeout: 10000 });
    expect(nube.conflictos).toBe(1);
    const antes = llamadasA(nube, 'actualizar_cotizacion_segura');
    // Red lenta para que el segundo clic caiga mientras el primero vuela.
    B.fallas.regla(B.fallas.rpc('actualizar_cotizacion_segura'), B.fallas.antes(3000));
    const t0 = Date.now();
    await banner.getByRole('button', { name: 'Volver a aplicar mis cambios' }).dblclick();
    await esperarNube(nube, (n) => n.filas.get(id).cliente === 'Doble SA Sur', 15_000);
    const ms = Date.now() - t0;
    await esperar(3500);
    T.imprimir({ guardados: llamadasA(nube, 'actualizar_cotizacion_segura') - antes, clic_a_guardado_ms: ms });
    expect(llamadasA(nube, 'actualizar_cotizacion_segura') - antes, 'un solo guardado').toBe(1);
    expect(nube.conflictos).toBe(1);
    expect(nube.filas.size).toBe(1);
    await expect(banner).toBeHidden();
    await A.context.close(); await B.context.close();
  });

  test('"Descargar PDF" con doble clic: UNA revisión conservada y UNA descarga', async ({ browser }) => {
    test.setTimeout(120_000);
    const T = tiempos('5d_doble_clic_pdf');
    const nube = crearNubeFalsa({ usuarios: USUARIOS });
    const id = nube.sembrarFila({ usuario: 'rodrigo@vh.mx', cliente: 'PDF SA', partidas: [SANA], total: 55680, piezas: 1 });
    const { context, page, fallas } = await contexto(browser, nube, { opciones: { acceptDownloads: true } });
    await entrar(page, 'rodrigo@vh.mx');
    await abrirPrimeraDelArchivo(page);
    const descargas = []; const tDescargas = []; page.on('download', (d) => { descargas.push(d.suggestedFilename()); tDescargas.push(Date.now()); });
    fallas.regla((ruta) => /\/rest\/v1\/rpc\/emitir_revision(_v2)?$/.test(ruta), fallas.antes(2000));   // emisión lenta: el 2º clic cae en vuelo
    const boton = page.locator('button.cot-pdf');
    await expect(boton).toBeEnabled();
    const t0 = Date.now();
    await boton.dblclick();
    await expect.poll(() => descargas.length, { timeout: 60_000 }).toBeGreaterThan(0);
    await esperar(5000);
    const tEmitir = fallas.vistos.find((v) => /\/emitir_revision(_v2)?$/.test(v.ruta))?.t;
    T.imprimir({ descargas: descargas.length, revisiones: nube.revisiones.length, emitir_llamadas: llamadasA(nube, 'emitir_revision'), clic_a_pdf_ms: tDescargas[0] - t0, clic_a_emision_ms: tEmitir ? tEmitir - t0 : null });
    expect(nube.revisiones.filter((r) => r.cotizacion_id === id)).toHaveLength(1);
    expect(llamadasA(nube, 'emitir_revision'), 'una sola emisión enviada').toBe(1);
    expect(descargas).toHaveLength(1);
    await context.close();
  });
});

// ============================================================================
//  6 · SESIÓN EXPIRADA (401 / 'no autorizado' en la RPC de guardado)
// ============================================================================
// Dos formas reales en que el servidor dice "tu sesión ya no sirve":
//  · PostgREST con el JWT vencido → HTTP 401 {code:'PGRST301', message:'JWT expired'};
//  · la RPC sin correo en el JWT o fuera de `permitidos` → `raise exception 'no autorizado'` (P0001), ver
//    supabase/tests/fixtures/private_api_prod_20261013.sql:60-62.
const RESPUESTAS_SESION = {
  jwt_vencido: { status: 401, cuerpo: { code: 'PGRST301', message: 'JWT expired', details: null, hint: null } },
  no_autorizado: { status: 400, cuerpo: { code: 'P0001', message: 'no autorizado', details: null, hint: null } },
};
// R-07 (P1 · CORREGIDO): medido antes del arreglo — JWT vencido: aviso de "sin conexión" (engañoso, la red estaba bien);
// 'no autorizado': NINGÚN aviso, punto "En línea", el cliente soltó el id y al volver a entrar creó la fila 101
// (la 100 se quedó con el dato viejo). Causa: clasificarErrorGuardado trataba 'no autorizado' como fila ajena.
test.describe('6 · Sesión expirada', () => {
  for (const [nombre, { status, cuerpo }] of Object.entries(RESPUESTAS_SESION)) {
    test(`${nombre}: avisa que es la SESIÓN, no borra lo local, se vuelve a entrar y se guarda en LA MISMA cotización`, async ({ browser }) => {
      test.setTimeout(120_000);
      const T = tiempos(`6_sesion_${nombre}`);
      const nube = crearNubeFalsa({ usuarios: USUARIOS });
      const { context, page, fallas } = await contexto(browser, nube, { estado: estadoLocal({ cotizacion: { cliente: 'Sesion SA', partidas: [PARTIDA] } }) });
      await entrar(page, 'ventas@vh.mx');
      await esperarNube(nube, (n) => n.filas.size === 1);
      const id = [...nube.filas.keys()][0];
      await expect.poll(async () => (await leerLocal(page)).cotizacion?.id).toBe(id);
      const vencida = fallas.regla((ruta) => ruta === '/rest/v1/rpc/actualizar_cotizacion_segura' || ruta === '/rest/v1/rpc/crear_cotizacion_segura', fallas.responder(status, cuerpo));
      await irACotizacion(page);
      const t0 = Date.now();
      await inputCliente(page).fill('Sesion SA Norte');
      await expect(page.locator('.toast', { hasText: /sesión/i })).toBeVisible({ timeout: 10000 });   // se dice QUÉ pasa
      const msAviso = Date.now() - t0;
      await expect(estadoNube(page)).not.toHaveAttribute('data-estado', 'conectado');                 // no finge "En línea"
      // Lo local NO se pierde ni se suelta el id (no es una fila ajena).
      const local = await leerLocal(page);
      expect(local.cotizacion).toMatchObject({ id, cliente: 'Sesion SA Norte' });
      expect(nube.filas.get(id).cliente).toBe('Sesion SA');
      // Volver a entrar.
      vencida.retirar();
      await page.getByRole('button', { name: /Salir/i }).first().click();
      await expect(page.locator('#email-login')).toBeVisible({ timeout: 10000 });
      await page.fill('#email-login', 'ventas@vh.mx'); await page.fill('#pass-login', PASS);
      await page.getByRole('button', { name: /^Entrar$/i }).click();
      await expect(page.getByRole('button', { name: /Salir/i }).first()).toBeVisible({ timeout: 45000 });
      await esperarNube(nube, (n) => n.filas.get(id).cliente === 'Sesion SA Norte', 15_000);
      const msRecupera = Date.now() - t0;
      await esperar(2500);
      expect(nube.filas.size, 'sin cotización duplicada').toBe(1);
      expect(nube.creates).toBe(1);
      T.imprimir({ edicion_a_aviso_ms: msAviso, edicion_a_guardado_tras_reentrar_ms: msRecupera });
      await context.close();
    });
  }
});

// ============================================================================
//  7 · CONCURRENCIA: una pestaña SIN RED que vuelve (lo que concurrenciaOptimista.e2e.js no cubre)
// ============================================================================
// "Sin red" = navigator.onLine=false (eventos offline/online reales) Y toda petición a la nube cortada: las rutas de
// Playwright interceptan antes que la emulación offline, así que el corte se inyecta también como regla.
async function sinRed(c, apagada) {
  if (apagada) { c._corte = c.fallas.regla(() => true, c.fallas.abortar('internetdisconnected')); await c.context.setOffline(true); }
  else { c._corte?.retirar(); await c.context.setOffline(false); }
}
test.describe('7 · Pestaña offline que vuelve', () => {
  // R-09 (P2 · CORREGIDO): antes, al volver la red la cotización seguía sólo en esta computadora hasta la siguiente
  // edición (el punto decía "Sin conexión", no era silencioso, pero si la persona cerraba, la nube no lo tenía).
  test('sin red: avisa, conserva lo local; al volver la red se guarda SOLO (sin que la persona tenga que editar otra vez)', async ({ browser }) => {
    test.setTimeout(90_000);
    const T = tiempos('7a_offline_vuelve_sin_editar');
    const nube = crearNubeFalsa({ usuarios: USUARIOS });
    const id = nube.sembrarFila({ usuario: 'ventas@vh.mx', cliente: 'Offline SA', partidas: [PARTIDA], total: 55680, piezas: 1 });
    const B = await contexto(browser, nube);
    await entrar(B.page, 'ventas@vh.mx'); await abrirPrimeraDelArchivo(B.page);
    await sinRed(B, true);
    await inputFolio(B.page).fill('OFF-1');
    await expect(estadoNube(B.page)).toHaveAttribute('data-estado', 'sin-conexion', { timeout: 10000 });
    await expect(B.page.locator('.toast', { hasText: /No se pudo guardar/ })).toBeVisible({ timeout: 10000 });
    expect((await leerLocal(B.page)).cotizacion.folio).toBe('OFF-1');
    expect(nube.filas.get(id).folio ?? null).toBeNull();
    const tOnline = Date.now();
    await sinRed(B, false);
    await esperarNube(nube, (n) => n.filas.get(id).folio === 'OFF-1', 15_000);
    const ms = Date.now() - tOnline;
    await expect(estadoNube(B.page)).toHaveAttribute('data-estado', 'conectado');
    T.imprimir({ red_de_vuelta_a_guardado_ms: ms });
    await B.context.close();
  });

  test('control optimista (VH-148): B edita SIN RED, A guarda; B vuelve → conflicto visible, lo de A intacto, lo de B sigue en su computadora', async ({ browser }) => {
    test.setTimeout(120_000);
    const T = tiempos('7b_offline_concurrencia_flag_on');
    const nube = crearNubeFalsa({ usuarios: USUARIOS });
    const id = nube.sembrarFila({ usuario: 'ventas@vh.mx', cliente: 'Conc SA', partidas: [PARTIDA], total: 55680, piezas: 1 });
    const A = await contexto(browser, nube, { flag: true }); const B = await contexto(browser, nube, { flag: true });
    await entrar(A.page, 'ventas@vh.mx'); await abrirPrimeraDelArchivo(A.page);
    await entrar(B.page, 'ventas@vh.mx'); await abrirPrimeraDelArchivo(B.page);
    await sinRed(B, true);
    await inputFolio(B.page).fill('B-OFF');
    await expect(estadoNube(B.page)).toHaveAttribute('data-estado', 'sin-conexion', { timeout: 10000 });
    await inputCliente(A.page).fill('Conc SA Norte');
    await esperarNube(nube, (n) => n.filas.get(id).cliente === 'Conc SA Norte');
    const filaA = JSON.parse(JSON.stringify(nube.filas.get(id)));
    const t0 = Date.now();
    await sinRed(B, false);
    await inputFolio(B.page).fill('B-OFF-2');   // B sigue trabajando al volver
    await expect(B.page.getByTestId('conflicto-guardado')).toBeVisible({ timeout: 15000 });
    const ms = Date.now() - t0;
    expect(nube.filas.get(id), 'lo de A no se pisó').toEqual(filaA);
    expect((await leerLocal(B.page)).cotizacion).toMatchObject({ id, folio: 'B-OFF-2', cliente: 'Conc SA' });
    expect(nube.filas.size).toBe(1);
    T.imprimir({ vuelta_a_conflicto_ms: ms, conflictos: nube.conflictos });
    await A.context.close(); await B.context.close();
  });

  // DEFECTO R-08 (P1 · pérdida silenciosa, PRODUCCIÓN HOY): sin la bandera VH-148 (no desplegada:
  // PROPUESTA_vh148_control_optimista_cotizacion.sql), la pestaña que vuelve de estar sin red manda su documento
  // COMPLETO y borra lo que la otra guardó en un campo que ella ni tocó (aquí: el cliente de A), sin aviso.
  // Misma causa raíz que concurrenciaOptimista.e2e.js ("bandera APAGADA"), agravada offline: la ventana del choque
  // dura lo que dure la desconexión. Se deja ROJA a propósito hasta desplegar VH-148 (SQL + VITE_CONTROL_OPTIMISTA=1).
  test('PRODUCCIÓN HOY (sin VH-148): B vuelve de estar sin red y NO debe borrar en silencio lo que A guardó', async ({ browser }) => {
    test.fail(true, 'R-08 (P1): sin control optimista desplegado, el último documento completo gana y pisa campos ajenos sin aviso');
    test.setTimeout(120_000);
    const T = tiempos('7c_offline_concurrencia_produccion');
    const nube = crearNubeFalsa({ usuarios: USUARIOS });
    const id = nube.sembrarFila({ usuario: 'ventas@vh.mx', cliente: 'Prod SA', partidas: [PARTIDA], total: 55680, piezas: 1 });
    const A = await contexto(browser, nube); const B = await contexto(browser, nube);
    await entrar(A.page, 'ventas@vh.mx'); await abrirPrimeraDelArchivo(A.page);
    await entrar(B.page, 'ventas@vh.mx'); await abrirPrimeraDelArchivo(B.page);
    await sinRed(B, true);
    await inputFolio(B.page).fill('B-OFF');
    await expect(estadoNube(B.page)).toHaveAttribute('data-estado', 'sin-conexion', { timeout: 10000 });
    await inputCliente(A.page).fill('Prod SA Norte');
    await esperarNube(nube, (n) => n.filas.get(id).cliente === 'Prod SA Norte');
    await sinRed(B, false);
    await inputFolio(B.page).fill('B-OFF-2');
    await esperarNube(nube, (n) => n.filas.get(id).folio === 'B-OFF-2', 15_000);
    T.imprimir({ cliente_final: nube.filas.get(id).cliente, conflictos: nube.conflictos });
    const pisado = nube.filas.get(id).cliente !== 'Prod SA Norte';
    const avisado = await B.page.getByTestId('conflicto-guardado').isVisible().catch(() => false);
    expect(pisado && !avisado, 'lo de A se perdió sin que nadie se enterara').toBe(false);
    await A.context.close(); await B.context.close();
  });
});

// ============================================================================
//  8 · OPERACIONES PROHIBIDAS para el vendedor (ver costos, aprobar, editar margen de Dirección)
// ============================================================================
// Llamada directa a la nube (falsa) desde el navegador del vendedor, con SU sesión: lo que haría un cliente
// manipulado. El instalador de fallas garantiza que nada sale a producción.
const rpcComo = (page, email, fn, body) => page.evaluate(async ({ url, token, body }) => {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, apikey: 'anon' }, body: JSON.stringify(body) });
  let j = null; try { j = await r.json(); } catch { j = null; }
  return { status: r.status, cuerpo: j };
}, { url: `${HOST}/rest/v1/rpc/${fn}`, token: tokenDe(email), body });

test.describe('8 · Operación prohibida para vendedor', () => {
  test('la interfaz no ofrece ni enseña lo de Dirección, aun con economía "colada" en su computadora', async ({ browser }) => {
    test.setTimeout(90_000);
    const T = tiempos('8a_ui_vendedor');
    const nube = crearNubeFalsa({ usuarios: USUARIOS });
    // Economía "colada" en el navegador del vendedor (respaldo viejo, manipulación): 12,345 de costo, 77 % de margen.
    const colada = { id: 'pc', nombre: 'Mesa colada', cantidad: 1, precioUnitario: 48000, costoUnitario: 12345, margen: 77, costoDerivado: false };
    const { context, page, fallas } = await contexto(browser, nube, { estado: estadoLocal({ cotizacion: { cliente: 'Colada SA', partidas: [colada] } }) });
    await entrar(page, 'ventas@vh.mx');
    await page.getByText('Más herramientas').click();
    for (const prohibido of [/^Costeo manual/, /^Dirección/, /^Usuarios y accesos/, /^Cargar compras del ERP/]) {
      await expect(page.getByRole('button', { name: prohibido }), `sin atajo ${prohibido}`).toHaveCount(0);
    }
    await irACotizacion(page);
    await expect(page.getByRole('button', { name: 'Mis números' })).toHaveCount(0);   // no hay vista con costos
    await expect(page.getByText(/12,345|12\.345/)).toHaveCount(0);                    // el costo colado no se enseña
    await expect(page.getByText(/77\s?%/)).toHaveCount(0);                             // ni el margen colado
    // Lo que llega a la NUBE: el guardado del vendedor no deja costo ni margen (el servidor lo quita).
    await esperarNube(nube, (n) => n.filas.size === 1);
    const fila = [...nube.filas.values()][0];
    expect(fila.partidas[0]).not.toHaveProperty('costoUnitario');
    expect(fila.partidas[0]).not.toHaveProperty('margen');
    const enviado = fallas.vistos.find((v) => v.ruta.endsWith('/crear_cotizacion_segura'))?.body?.p_payload?.partidas?.[0] || {};
    T.imprimir({ cliente_envio_costo: 'costoUnitario' in enviado, cliente_envio_margen: 'margen' in enviado });
    await context.close();
  });

  test('llamadas directas del vendedor: aprobar, ver costos, editar margen y cargar ERP fallan de forma segura y no cambian nada', async ({ browser }) => {
    test.setTimeout(90_000);
    const T = tiempos('8b_llamadas_vendedor');
    const nube = crearNubeFalsa({ usuarios: USUARIOS });
    const idD = nube.sembrarFila({ usuario: 'ventas@vh.mx', cliente: 'Con costos SA', partidas: [SANA], total: 55680, piezas: 1 });
    const idV = nube.sembrarFila({ usuario: 'ventas@vh.mx', cliente: 'Propia SA', partidas: [PARTIDA], total: 55680, piezas: 1 });
    nube.aprobaciones.push({ id: 1, cotizacion_id: idD, revision_hash: 'h', estado: 'PENDIENTE', solicitado_por: 'ventas@vh.mx', reglas_version: 1 });
    const { context, page } = await contexto(browser, nube);
    await entrar(page, 'ventas@vh.mx');
    const t0 = Date.now();
    // (1) aprobar su propia solicitud
    const ap = await rpcComo(page, 'ventas@vh.mx', 'resolver_aprobacion', { p_id: 1, p_estado: 'APROBADA' });
    expect(ap.status).toBeGreaterThanOrEqual(400);
    expect(nube.aprobaciones[0].estado).toBe('PENDIENTE');
    // (2) ver costos de una cotización con economía de Dirección
    const ver = await rpcComo(page, 'ventas@vh.mx', 'cotizacion_segura', { p_id: idD });
    expect(ver.status).toBe(200);
    expect(JSON.stringify(ver.cuerpo)).not.toMatch(/costoUnitario|"margen"|costoDerivado/);
    const lista = await rpcComo(page, 'ventas@vh.mx', 'cotizaciones_mias', {});
    expect(JSON.stringify(lista.cuerpo)).not.toMatch(/costoUnitario|"margen"/);
    // (3) escribir margen/costo en su propia cotización
    const ed = await rpcComo(page, 'ventas@vh.mx', 'actualizar_cotizacion_segura', { p_cotizacion_id: idV, p_patch: { partidas: [{ ...PARTIDA, costoUnitario: 1, margen: 99 }] } });
    expect(ed.status).toBe(200);
    expect(nube.filas.get(idV).partidas[0]).not.toHaveProperty('margen');
    expect(nube.filas.get(idV).partidas[0]).not.toHaveProperty('costoUnitario');
    // (4) emitir con estado protegido / cargar compras del ERP
    const est = await rpcComo(page, 'ventas@vh.mx', 'actualizar_cotizacion_segura', { p_cotizacion_id: idV, p_patch: { estado: 'emitida' } });
    expect(est.status).toBeGreaterThanOrEqual(400);
    expect(nube.filas.get(idV).estado).toBe('borrador');
    const erp = await rpcComo(page, 'ventas@vh.mx', 'cargar_erp_ultima_compra', { p_documento: 'X', p_catalogo: [{}], p_precios: [{}] });
    expect(erp.status).toBeGreaterThanOrEqual(400);
    expect(nube.cargasErp ?? []).toHaveLength(0);
    T.imprimir({ llamadas_ms: Date.now() - t0 });
    await context.close();
  });

  test('la cola de aprobaciones no existe para el vendedor (Archivo) y la Dirección sí la ve', async ({ browser }) => {
    test.setTimeout(90_000);
    const T = tiempos('8c_ui_aprobaciones');
    const nube = crearNubeFalsa({ usuarios: USUARIOS });
    const id = nube.sembrarFila({ usuario: 'ventas@vh.mx', cliente: 'Cola SA', partidas: [PARTIDA], total: 55680, piezas: 1 });
    nube.aprobaciones.push({ id: 1, cotizacion_id: id, revision_hash: 'h', estado: 'PENDIENTE', solicitado_por: 'ventas@vh.mx', reglas_version: 1, motivo: 'precio especial' });
    const V = await contexto(browser, nube);
    await entrar(V.page, 'ventas@vh.mx');
    await V.page.getByText('Más herramientas').click();
    await V.page.getByRole('button', { name: /^Presupuestos anteriores/ }).click();
    await expect(V.page.getByTestId('respaldo-local')).toBeVisible({ timeout: 10000 });
    await expect(V.page.getByTestId('aprobaciones-pendientes')).toHaveCount(0);
    await expect(V.page.getByRole('button', { name: /^Aprobar$/ })).toHaveCount(0);
    const D = await contexto(browser, nube);
    await entrar(D.page, 'rodrigo@vh.mx');
    await D.page.getByText('Más herramientas').click();
    await D.page.getByRole('button', { name: /^Presupuestos anteriores/ }).click();
    await expect(D.page.getByTestId('aprobaciones-pendientes')).toContainText('Aprobaciones pendientes (1)', { timeout: 15000 });
    T.imprimir();
    await V.context.close(); await D.context.close();
  });
});
