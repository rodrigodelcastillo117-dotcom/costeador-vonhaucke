// ============================================================================
//  BARRIDO CON RESULTADO (auditoría externa 2026-10-19). barridoPantallas.e2e.js prueba que cada pantalla del
//  Inicio ABRE; aquí cada flujo crítico es botón → acción → RESULTADO VERIFICABLE, no "el clic no lanzó":
//    Guardar → la nube recibió la fila (MISMO id) y la cabecera dice "En línea"
//    Descargar PDF → evento download, archivo > 0 bytes que empieza con %PDF, revisión conservada
//    Aplicar programa detectado → cambian las partidas (entra lo que falta, lo existente intacto)
//    Fusionar duplicados → cantidades correctas (un ancla, la de la persona, atada al plano)
//    Atrás / pasos de Voni → conservan el estado (cantidades y el pedido a medio escribir)
//    Reintentar tras un error de red → hace OTRA petición y la pantalla se recupera
//    Error tardío en un botón → aviso no destructivo, la app sigue usable, el error sigue en consola
//  En CADA prueba una vigía escucha pageerror, console.error, unhandledrejection y HTTP 4xx/5xx de la API (nube
//  falsa) y del servidor de la app; sólo pasa lo que la prueba provocó a propósito (lista blanca abajo).
//  Corre contra la nube falsa (e2e/nubeFalsa.js): prueba el CLIENTE; no toca producción.
// ============================================================================
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { crearNubeFalsa, estadoLocal, CLAVE_LOCAL, HOST } from './nubeFalsa.js';

const USUARIOS = { 'rodrigo@vh.mx': 'direccion', 'ventas@vh.mx': 'vendedor' };
const PASS = 'prueba-123';

// ---------------------------------------------------------------------------
//  LISTA BLANCA de console.error (explícita y justificada). Todo lo demás reprueba la prueba.
//   1) "Failed to load resource: … status of NNN" → Chrome lo escribe SOLO por cada respuesta HTTP con error.
//      Se permite únicamente si ESA respuesta está en las permitidas de la prueba (fallas inyectadas a propósito);
//      la vigía cruza la URL del mensaje con la lista. Una 4xx/5xx no provocada reprueba dos veces (HTTP y consola).
//   2) "net::ERR_INTERNET_DISCONNECTED / ERR_FAILED" → sólo en la prueba que corta la red a propósito (permitirRedCaida).
//  Nada más: un "Warning:" de React, un error de la app o de una librería es un defecto y reprueba.
// ---------------------------------------------------------------------------
const RX_RECURSO = /^Failed to load resource: the server responded with a status of (\d{3})/;
const RX_RED_CAIDA = /net::ERR_(INTERNET_DISCONNECTED|FAILED|CONNECTION_FAILED|CONNECTION_RESET)/;

// Rutas que son API (lo que la app le pide a la nube) o archivos de la app. Las imágenes públicas de marca/catálogo
// (Storage público) pasan a la red real y no son parte de los flujos: no se vigilan.
const esVigilada = (url) => {
  if (url.startsWith(HOST)) return !/\/storage\/v1\/object\/public\//.test(url);
  try { return /^localhost$|^127\.0\.0\.1$/.test(new URL(url).hostname); } catch { return false; }
};

function vigia(page) {
  const problemas = [];
  const permitidas = [];          // { rx: RegExp de URL, status?: number, motivo }
  let redCaidaPermitida = false;
  const permitida = (url, status) => permitidas.some((p) => p.rx.test(url) && (p.status == null || p.status === status));
  page.on('pageerror', (e) => problemas.push(`pageerror: ${String(e?.message || e).slice(0, 300)}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    const url = m.location()?.url || '';
    const r = RX_RECURSO.exec(t);
    if (r && permitida(url, Number(r[1]))) return;
    if (redCaidaPermitida && RX_RED_CAIDA.test(t)) return;
    problemas.push(`console.error: ${t.slice(0, 300)}${url ? ` @ ${url.slice(0, 160)}` : ''}`);
  });
  page.on('response', (r) => {
    const url = r.url(); const s = r.status();
    if (s >= 400 && esVigilada(url) && !permitida(url, s)) problemas.push(`HTTP ${s} ${r.request().method()} ${url.slice(0, 160)}`);
  });
  return {
    problemas,
    permitir(rx, status, motivo) { permitidas.push({ rx, status, motivo }); },
    permitirRedCaida() { redCaidaPermitida = true; },
    // unhandledrejection: se anota en la página (init script) y se lee al final.
    async rechazos() { return page.evaluate(() => (window.__vhRechazos || []).slice()).catch(() => []); },
    async verificar() {
      const rech = await this.rechazos();
      const todos = [...problemas, ...rech.map((x) => `unhandledrejection: ${x}`)];
      expect(todos, `errores no esperados:\n${todos.join('\n')}`).toEqual([]);
      // Y ningún aviso de error tardío (lo pinta main.jsx ante un error no atrapado).
      await expect(page.getByTestId('aviso-error-tardio')).toHaveCount(0);
    },
  };
}

async function arrancar(browser, { email = 'ventas@vh.mx', estado = estadoLocal(), nube = crearNubeFalsa({ usuarios: USUARIOS }), extra = {}, opciones = {} } = {}) {
  const context = await browser.newContext(opciones);
  await nube.instalar(context);
  await context.addInitScript(({ k, v, extra }) => {
    window.__vhRechazos = [];
    window.addEventListener('unhandledrejection', (e) => { try { window.__vhRechazos.push(String(e?.reason?.message || e?.reason).slice(0, 300)); } catch { /* nada */ } });
    if (!localStorage.getItem('__sembrado__')) {
      localStorage.setItem(k, JSON.stringify(v)); localStorage.setItem('__sembrado__', '1');
      for (const [a, b] of Object.entries(extra)) localStorage.setItem(a, b);
    }
  }, { k: CLAVE_LOCAL, v: estado, extra });
  const page = await context.newPage();
  const v = vigia(page);
  page.on('dialog', (d) => d.accept().catch(() => {}));
  await page.goto('/');
  await page.fill('#email-login', email);
  await page.fill('#pass-login', PASS);
  await page.getByRole('button', { name: /^Entrar$/i }).click();
  await expect(page.getByRole('button', { name: /Salir/i }).first()).toBeVisible({ timeout: 20000 });
  if (await page.getByRole('dialog', { name: /Guía de uso/i }).isVisible().catch(() => false)) await page.keyboard.press('Escape');
  return { nube, context, page, vigia: v };
}

const leerLocal = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '{}'), CLAVE_LOCAL);
const partidasLocales = async (page) => (await leerLocal(page)).cotizacion?.partidas || [];
const estadoNube = (page) => page.getByTestId('nube-estado');
const esperarNube = (nube, cond, ms = 10000) => expect.poll(() => cond(nube), { timeout: ms }).toBe(true);
const filaUnica = (nube) => { expect(nube.filas.size, 'una sola cotización en la nube').toBe(1); return [...nube.filas.values()][0]; };
const cuenta = (ps, id) => ps.filter((p) => p.piezaId === id || p.bancoId === id).length;
const cantidadDe = (ps, id) => ps.filter((p) => p.piezaId === id || p.bancoId === id).reduce((s, p) => s + (p.cantidad || 0), 0);
async function abrirPrimeraDelArchivo(page) {
  await page.getByText('Más herramientas').click();
  await page.getByRole('button', { name: /^Presupuestos anteriores/ }).click();
  await expect(page.getByTestId('respaldo-local')).toBeVisible({ timeout: 10000 });
  await page.getByRole('button', { name: /^Abrir$/ }).first().click();
}
async function irAMuebles(page) {
  await page.getByTestId('home-cotizar').click();
  await page.getByTestId('voni-paso-muebles').click();
}

// Un mueble de LÍNEA (editable: ruta + producto + config) y uno de banco.
const BANCA = { id: 'l1', ruta: 'applt', productoId: 'banca_doble', config: { producto: 'banca_doble', largoMM: 1200, fondoMM: 1200, usuarios: 6, biombo: 'pet' }, nombre: 'Banca doble APP LT 6 usuarios', cantidad: 1, precioUnitario: 48000 };
const SILLAS = { id: 'p2', nombre: 'Silla operativa', cantidad: 6, precioUnitario: 3200 };

// Proyecto parcial con plano y brief (caso P0.1 de Rodrigo, e2e/programaP01.e2e.js) — aquí contra la nube falsa.
const PARCIAL = [
  { id: 'e-win', piezaId: 'silla-win', nombre: 'Silla operativa WIN', cantidad: 10, precioUnitario: 5210 },
  { id: 'e-gav', piezaId: 'gaveta-mox', nombre: 'Mox · Gaveta pedestal', cantidad: 10, precioUnitario: 3470 },
  { id: 'e-alpha', piezaId: 'silla-alpha', nombre: 'Silla directiva ALPHA', cantidad: 1, precioUnitario: 11950 },
  { id: 'e-conc', piezaId: 'silla-concerto', nombre: 'Silla de visita CONCERTO', cantidad: 2, precioUnitario: 5140 },
  { id: 'e-mesa', piezaId: 'mj-1200x1200-melamina', nombre: 'Mesa de juntas', cantidad: 1, precioUnitario: 5510 },
  { id: 'e-son', piezaId: 'silla-sonata', nombre: 'Silla de juntas SONATA', cantidad: 4, precioUnitario: 2420 },
  { id: 'e-rec', piezaId: 'rec-2420x830', nombre: 'Módulo recepción', cantidad: 1, precioUnitario: 29920 },
  { id: 'e-arch', piezaId: 'arch-modulor-2p-900', nombre: 'Archivero Modulor', cantidad: 1, precioUnitario: 7230 },
];
const BRIEF = { linea: 'App LT', operativosStorage: true, privados: [{ requested_models: { anchor: 'Eclipse Drift 2.10' } }], juntas: [{ requested_dimensions: { w: 1200, d: 1200 } }] };
const AREAS = [
  { nombre: 'OFICINA CEO', tipo: 'privado', ancho: 4, largo: 3.2 },
  { nombre: 'SALA DE CONSEJO', tipo: 'juntas', ancho: 7, largo: 3.2, puestos: 4 },
  { nombre: 'ÁREA OPERATIVA', tipo: 'open', ancho: 8, largo: 3.2, puestos: 10 },
  { nombre: 'RECEPCIÓN', tipo: 'recepcion', ancho: 4, largo: 2.4 },
];
// El mismo proyecto con el programa YA aplicado (lo que deja "Aplicar programa detectado": el bench App LT de 10 y
// 2 GAMMA-E de recepción como CONFIRMADO_PROGRAMA) y DESPUÉS la persona describió con Voni una banca de 10:
// el ancla de trabajo quedó DOS veces. El Drift pendiente impide que el piloto automático lo fusione solo.
const OP = 'inst:req:ÁREA OPERATIVA:operativo:0:#0';
const JUNTAS = 'inst:req:SALA DE CONSEJO:juntas:0:#0';
const REC = 'inst:req:RECEPCIÓN:recepcion:0:#0';
const enZona = (zona, req, inst) => ({ functional_group_id: inst.replace(/^inst:/, 'fg:'), requirement_id: req, zone_id: zona });
// Tal como quedan las partidas existentes tras "Aplicar programa detectado" (vinculadas a su zona; medido en navegador).
const VINCULADAS = {
  'e-win': { relation_role: 'WORK_SEAT', anchor_role: 'ANCHOR_WORKSTATION', anchor_instance_id: OP, instance_id: null, ...enZona('ÁREA OPERATIVA', 'req:ÁREA OPERATIVA:operativo:0', OP) },
  'e-gav': { relation_role: 'UNDERDESK_STORAGE', anchor_role: 'ANCHOR_WORKSTATION', anchor_instance_id: OP, instance_id: null, ...enZona('ÁREA OPERATIVA', 'req:ÁREA OPERATIVA:operativo:0', OP) },
  'e-mesa': { relation_role: 'ANCHOR_MEETING', anchor_role: null, anchor_instance_id: null, instance_id: JUNTAS, user_capacity: 4, ...enZona('SALA DE CONSEJO', 'req:SALA DE CONSEJO:juntas:0', JUNTAS) },
  'e-son': { relation_role: 'MEETING_SEAT', anchor_role: 'ANCHOR_MEETING', anchor_instance_id: JUNTAS, instance_id: null, ...enZona('SALA DE CONSEJO', 'req:SALA DE CONSEJO:juntas:0', JUNTAS) },
  'e-rec': { relation_role: 'ANCHOR_RECEPTION', anchor_role: null, anchor_instance_id: null, instance_id: REC, user_capacity: 2, ...enZona('RECEPCIÓN', 'req:RECEPCIÓN:recepcion:0', REC) },
};
const PROGRAMA_APLICADO = [
  ...PARCIAL.map((p) => ({ ...p, ...(VINCULADAS[p.id] || {}) })),
  { id: 'prog-op', piezaId: 'op-10u-6000x1200-cristal', bancoId: 'op-10u-6000x1200-cristal', nombre: 'Módulo operativo App LT 10 usuarios (biombo cristal)', w: 6000, d: 1200, usuarios: 10, user_capacity: 10, linea: 'App LT', cantidad: 1,
    relation_role: 'ANCHOR_WORKSTATION', instance_id: OP, functional_group_id: 'fg:req:ÁREA OPERATIVA:operativo:0:#0', requirement_id: 'req:ÁREA OPERATIVA:operativo:0', zone_id: 'ÁREA OPERATIVA',
    precioUnitario: 28540, sinPrecioAutorizado: true, config: { usuarios: 10 }, source: 'CONFIRMADO_PROGRAMA' },
  { id: 'prog-gamma', piezaId: 'silla-gamma-e', bancoId: 'silla-gamma-e', nombre: 'Silla operativa GAMMA-E', cantidad: 2, relation_role: 'WORK_SEAT', anchor_role: 'ANCHOR_RECEPTION',
    anchor_instance_id: REC, ...enZona('RECEPCIÓN', 'req:RECEPCIÓN:recepcion:0', REC),
    precioUnitario: 4140, sinPrecioAutorizado: true, source: 'CONFIRMADO_PROGRAMA' },
  { id: 'p-banca', nombre: 'Banca doble APP LT 1.50 · 10 usuarios · ocupa 6.00 × 1.20 m', piezaId: 'linea-banca_doble', productoId: 'banca_doble', cantidad: 1, precioUnitario: 26145, w: 6000, d: 1200, origen: 'ia' },
];

test.describe('Barrido con resultado: botón → acción → resultado verificable', () => {
  test('Guardar cambios de un mueble → la nube recibe la MISMA fila con el cambio y la cabecera dice "En línea"', async ({ browser }) => {
    test.setTimeout(90_000);
    const { nube, context, page, vigia: v } = await arrancar(browser, { estado: estadoLocal({ cotizacion: { cliente: 'Guardar SA', partidas: [BANCA, SILLAS] } }) });
    await esperarNube(nube, (n) => n.filas.size === 1);
    const id = [...nube.filas.keys()][0];
    await expect.poll(async () => (await leerLocal(page)).cotizacion?.id).toBe(id);
    await expect(estadoNube(page)).toHaveAttribute('data-estado', 'conectado');

    await page.getByRole('button', { name: /Mi cotización/i }).first().click();
    await page.getByRole('button', { name: /^Editar Banca doble/ }).click();
    const dialogo = page.locator('.ed-pie');
    await expect(dialogo).toBeVisible();
    await page.locator('.guia-cuerpo').getByRole('button', { name: '8', exact: true }).click();     // usuarios 6 → 8
    await page.locator('.guia-cuerpo').getByRole('button', { name: 'Más' }).click();               // cantidad 1 → 2
    await expect(page.locator('.ed-nombre')).toContainText('8 usuarios');
    const updates = nube.updates;
    await page.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(dialogo).toHaveCount(0);

    // Resultado: local, nube (MISMA fila) y cabecera.
    const banca = (await partidasLocales(page)).find((p) => p.id === 'l1');
    expect(banca.cantidad).toBe(2);
    expect(banca.config.usuarios).toBe(8);
    await esperarNube(nube, (n) => n.filas.get(id)?.partidas?.find((p) => p.id === 'l1')?.cantidad === 2);
    const fila = filaUnica(nube);
    expect(fila.id).toBe(id);
    expect(nube.creates).toBe(1);
    expect(nube.updates).toBeGreaterThan(updates);
    expect(fila.partidas.find((p) => p.id === 'l1').nombre).toMatch(/8 usuarios/);
    expect(fila.partidas.find((p) => p.id === 'p2').cantidad).toBe(6);   // lo demás intacto
    await expect(estadoNube(page)).toHaveAttribute('data-estado', 'conectado');
    await expect(estadoNube(page)).toContainText('En línea');
    await v.verificar();
    await context.close();
  });

  test('Descargar PDF → descarga real: archivo > 0 bytes que empieza con %PDF y la revisión queda conservada', async ({ browser }) => {
    test.setTimeout(120_000);
    const nube = crearNubeFalsa({ usuarios: USUARIOS });
    const SANA = { id: 'p1', nombre: 'Banca APP LT 6 usuarios', cantidad: 1, precioUnitario: 48000, costoUnitario: 21000, margen: 30, costoDerivado: false };
    const id = nube.sembrarFila({ usuario: 'rodrigo@vh.mx', cliente: 'PDF SA', partidas: [SANA], total: 55680, piezas: 1 });
    const { context, page, vigia: v } = await arrancar(browser, { email: 'rodrigo@vh.mx', nube, opciones: { acceptDownloads: true } });
    await abrirPrimeraDelArchivo(page);
    const boton = page.locator('button.cot-pdf');
    await expect(boton).toBeEnabled({ timeout: 15000 });
    const [descarga] = await Promise.all([page.waitForEvent('download', { timeout: 60_000 }), boton.click()]);
    expect(descarga.suggestedFilename()).toMatch(/\.pdf$/i);
    const ruta = await descarga.path();
    const bytes = fs.readFileSync(ruta);
    expect(bytes.length).toBeGreaterThan(1000);
    expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(bytes.subarray(-1024).toString('latin1')).toContain('%%EOF');   // archivo completo, no truncado
    await expect.poll(() => nube.revisiones.filter((r) => r.cotizacion_id === id).length, { timeout: 10000 }).toBe(1);
    await expect(boton).toBeEnabled();   // el botón vuelve: se puede volver a descargar
    await v.verificar();
    await context.close();
  });

  test('Aplicar programa detectado → entra lo que faltaba, lo existente queda igual y la nube lo recibe', async ({ browser }) => {
    test.setTimeout(90_000);
    const { nube, context, page, vigia: v } = await arrancar(browser, { email: 'rodrigo@vh.mx',
      estado: estadoLocal({ cotizacion: { cliente: 'Programa SA', partidas: PARCIAL, programaBrief: BRIEF, acomodo: { areasM: AREAS } } }) });
    await esperarNube(nube, (n) => n.filas.size === 1);
    await irAMuebles(page);
    const panel = page.getByTestId('programa-detectado');
    await expect(panel).toBeVisible({ timeout: 15000 });
    await expect(panel).toContainText(/Por agregar/);
    const antes = await partidasLocales(page);
    expect(cuenta(antes, 'op-10u-6000x1200-cristal')).toBe(0);

    await page.getByRole('button', { name: 'Aplicar programa detectado' }).click();

    await expect.poll(async () => cuenta(await partidasLocales(page), 'op-10u-6000x1200-cristal')).toBe(1);
    const desp = await partidasLocales(page);
    expect(desp).toHaveLength(antes.length + 2);                        // el bench y las GAMMA-E de recepción
    expect(cantidadDe(desp, 'silla-gamma-e')).toBe(2);
    for (const p of PARCIAL) expect(cantidadDe(desp, p.piezaId), p.nombre).toBe(p.cantidad);   // nada existente cambió de cantidad
    expect(desp.some((p) => String(p.piezaId || p.bancoId || '').startsWith('dir-'))).toBe(false);   // el Drift NO se sustituyó solo
    expect(desp.find((p) => p.id === 'e-win').anchor_instance_id).toBe(OP);   // las WIN quedaron atadas al bench del plano
    await expect(panel).not.toContainText(/Por agregar/);
    // La nube recibió exactamente eso en LA MISMA fila.
    await esperarNube(nube, (n) => cuenta(filaUnica(n).partidas || [], 'op-10u-6000x1200-cristal') === 1);
    expect(filaUnica(nube).partidas).toHaveLength(antes.length + 2);
    expect(nube.creates).toBe(1);
    await v.verificar();
    await context.close();
  });

  test('Fusionar duplicados con el programa → un solo ancla de trabajo (la de la persona) atada al plano; cantidades correctas', async ({ browser }) => {
    test.setTimeout(90_000);
    const { nube, context, page, vigia: v } = await arrancar(browser, { email: 'rodrigo@vh.mx',
      estado: estadoLocal({ cotizacion: { cliente: 'Fusion SA', partidas: PROGRAMA_APLICADO, programaBrief: BRIEF, acomodo: { areasM: AREAS } } }) });
    await esperarNube(nube, (n) => n.filas.size === 1);
    await irAMuebles(page);
    await expect(page.getByTestId('duplicados-programa')).toBeVisible({ timeout: 15000 });
    const fusionar = page.getByRole('button', { name: /^Fusionar 1 duplicado\(s\) con el programa$/ });
    await expect(fusionar).toBeEnabled();
    const antes = await partidasLocales(page);
    expect(antes.filter((p) => p.relation_role === 'ANCHOR_WORKSTATION' || /banca|operativo App LT/i.test(p.nombre))).toHaveLength(2);

    await fusionar.click();

    await expect.poll(async () => (await partidasLocales(page)).length).toBe(antes.length - 1);
    const desp = await partidasLocales(page);
    const anclas = desp.filter((p) => p.relation_role === 'ANCHOR_WORKSTATION');
    expect(anclas).toHaveLength(1);
    expect(anclas[0].id).toBe('p-banca');                     // gana lo que describió la persona (su precio y medida)
    expect(anclas[0].cantidad).toBe(1);
    expect(anclas[0].precioUnitario).toBe(26145);
    expect(anclas[0].instance_id).toBe(OP);                  // y hereda el lugar del plano
    expect(cuenta(desp, 'op-10u-6000x1200-cristal')).toBe(0);
    for (const p of PARCIAL) expect(cantidadDe(desp, p.piezaId), p.nombre).toBe(p.cantidad);
    expect(cantidadDe(desp, 'silla-gamma-e')).toBe(2);
    await expect(page.getByTestId('duplicados-programa')).toHaveCount(0);
    await esperarNube(nube, (n) => (filaUnica(n).partidas || []).length === antes.length - 1);
    expect(nube.creates).toBe(1);
    await v.verificar();
    await context.close();
  });

  test('Atrás y pasos de Voni conservan el estado: cantidades cambiadas y el pedido a medio escribir', async ({ browser }) => {
    test.setTimeout(90_000);
    const { context, page, vigia: v } = await arrancar(browser, { estado: estadoLocal({ cotizacion: { cliente: 'Pasos SA', partidas: [BANCA, SILLAS] } }) });
    await irAMuebles(page);
    await page.getByRole('button', { name: /Revisar lo que entendí \(2\)/ }).click();
    const lista = page.locator('.voni-lista');
    await expect(lista).toBeVisible();
    await lista.getByRole('button', { name: '+' }).first().click();                         // banca 1 → 2
    await expect.poll(async () => (await partidasLocales(page)).find((p) => p.id === 'l1').cantidad).toBe(2);

    // "‹ Volver a describir": la lista sigue (2 muebles) y se escribe un pedido nuevo SIN mandarlo.
    await page.getByRole('button', { name: /Volver a describir o agregar más/ }).click();
    const pedido = page.locator('textarea.ia-textarea').first();
    await expect(pedido).toBeVisible();
    const BORRADOR = 'Agrega una credenza ejecutiva y 2 sillas de visita';
    await pedido.fill(BORRADOR);

    // Paso "Espacio" y de regreso a "Muebles": nada se pierde.
    await page.getByTestId('voni-paso-espacio').click();
    await expect(page.getByTestId('voni-paso-espacio')).toHaveClass(/voni-paso-activo/);
    await page.getByTestId('voni-paso-muebles').click();
    await expect(page.locator('textarea.ia-textarea').first()).toHaveValue(BORRADOR);

    // "‹ Atrás" de la barra (sale de Cotizar) y volver a entrar: mismo paso, mismo pedido, mismas cantidades.
    await page.getByRole('button', { name: '‹ Atrás' }).click();
    await expect(page.getByTestId('home-cotizar')).toBeVisible();
    await page.getByTestId('home-cotizar').click();
    await expect(page.getByTestId('voni-paso-muebles')).toHaveClass(/voni-paso-activo/);
    await expect(page.locator('textarea.ia-textarea').first()).toHaveValue(BORRADOR);
    await page.getByRole('button', { name: /Revisar lo que entendí \(2\)/ }).click();
    const ps = await partidasLocales(page);
    expect(ps.find((p) => p.id === 'l1').cantidad).toBe(2);
    expect(ps.find((p) => p.id === 'p2').cantidad).toBe(6);
    expect(ps).toHaveLength(2);
    await v.verificar();
    await context.close();
  });

  test('Reintentar tras un error de red → hace OTRA petición y la pantalla se recupera', async ({ browser }) => {
    test.setTimeout(90_000);
    const { context, page, vigia: v } = await arrancar(browser, { email: 'rodrigo@vh.mx', extra: { vh_flags: JSON.stringify({ commercial_v2: true }) } });
    let fallar = true; let peticiones = 0;
    v.permitir(/\/rest\/v1\/proyectos/, 503, 'falla inyectada: la lista de proyectos no carga hasta que la red vuelve');
    await context.route(`${HOST}/rest/v1/proyectos*`, (route) => {
      peticiones += 1;
      if (fallar) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST000', message: 'upstream unavailable', details: null, hint: null }) });
      return route.fallback();   // la nube falsa contesta (lista vacía)
    });
    await page.getByText('Más herramientas').click();
    await page.getByRole('button', { name: /^Comercial/ }).first().click();
    const error = page.locator('.alerta.roja', { hasText: 'No se pudo cargar' });
    await expect(error).toBeVisible({ timeout: 15000 });
    const antes = peticiones;
    expect(antes).toBeGreaterThan(0);
    fallar = false;
    await error.getByRole('button', { name: 'Reintentar' }).click();
    await expect(page.getByText('Todo al día ✓')).toBeVisible({ timeout: 10000 });
    expect(peticiones, 'Reintentar hizo otra petición').toBeGreaterThan(antes);
    await expect(error).toHaveCount(0);
    await v.verificar();
    await context.close();
  });
});

test.describe('Error tardío en un botón (después de montar): aviso no destructivo', () => {
  test('el aviso aparece con referencia, la app sigue usable, el DOM de la app no se toca y el error sigue en consola', async ({ browser }) => {
    test.setTimeout(90_000);
    const { context, page, vigia: v } = await arrancar(browser, { estado: estadoLocal({ cotizacion: { cliente: 'Tardio SA', partidas: [SILLAS] } }) });
    // Un manejador que truena DESPUÉS del montaje (lo que antes quedaba sólo en consola: "le piqué y no hizo nada").
    await page.evaluate(() => {
      document.querySelector('[data-testid="home-cotizar"]').addEventListener('click', () => { throw new Error('boom-e2e: manejador roto'); });
    });
    const raizAntes = await page.locator('#raiz').evaluate((r) => r.firstElementChild?.outerHTML.length || 0);
    await page.getByTestId('home-cotizar').click();
    const aviso = page.getByTestId('aviso-error-tardio');
    await expect(aviso).toBeVisible({ timeout: 5000 });
    await expect(aviso).toHaveAttribute('role', 'alert');
    await expect(aviso).toContainText('No se pudo completar esta acción. Tu trabajo sigue guardado.');
    await expect(page.getByTestId('aviso-error-tardio-ref')).toHaveText(/^Ref\. E-[0-9A-Z]{6}$/);
    // Fuera de #raiz: React no se entera; la app no se reemplazó.
    expect(await aviso.evaluate((el) => !document.getElementById('raiz').contains(el))).toBe(true);
    expect(raizAntes).toBeGreaterThan(0);
    await expect(page.getByText('La app no pudo abrir')).toHaveCount(0);
    // El error NO se escondió: llegó a la consola como no atrapado (pageerror) — y la vigía lo registró.
    expect(v.problemas.some((p) => /pageerror: boom-e2e/.test(p))).toBe(true);
    // La app sigue usable: el clic de React sí corrió (Cotizar abrió) y se puede seguir.
    await expect(page.getByTestId('voni-paso-muebles')).toBeVisible({ timeout: 10000 });
    // Cerrar.
    await aviso.getByRole('button', { name: 'Cerrar aviso' }).click();
    await expect(aviso).toHaveCount(0);
    await page.getByRole('button', { name: /^Inicio$/ }).first().click();
    await expect(page.getByTestId('home-cotizar')).toBeVisible();

    // Ráfaga (promesas rechazadas sin catch): UN aviso que cuenta las veces; unhandledrejection también se avisa.
    await page.waitForTimeout(5200);   // fuera de la ventana de agrupación del aviso anterior
    await page.evaluate(() => { for (let i = 0; i < 3; i++) Promise.reject(new Error(`boom-promesa-${i}`)); });
    await expect(aviso).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('aviso-error-tardio-ref')).toHaveText(/\(3 veces\)$/);
    await expect(page.locator('[data-testid="aviso-error-tardio"]')).toHaveCount(1);
    expect((await v.rechazos()).filter((x) => /boom-promesa/.test(x))).toHaveLength(3);
    // Lo provocado a propósito queda fuera de la verificación final; nada MÁS debe haber pasado.
    const ajenos = v.problemas.filter((p) => !/boom-e2e|boom-promesa/.test(p));
    expect(ajenos, ajenos.join('\n')).toEqual([]);
    await context.close();
  });
});
