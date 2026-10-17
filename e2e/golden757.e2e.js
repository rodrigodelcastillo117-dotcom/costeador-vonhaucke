import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { construirRespuestaAcomodo } from '../supabase/functions/acomodar-espacio-recovery/recoveryPipeline.js';

// ============================================================================
//  GOLDEN · EL PROYECTO DE LAS CAPTURAS (cotización 757 real, plano ARQ-01 "Torre Sur").
//  Semilla = las 18 partidas tal como quedaron en producción (7 del programa del plano
//  con producto genérico + 11 de VONI texto) y las 7 áreas leídas del plano.
//  ANTES (producción 766df46): 18 sillas para 10 puestos, dos mesas, dos módulos
//  directivos, conflicto sin salida, 9 de 34 colocadas, "4 silla de juntass".
//  AQUÍ el solver es el REAL (recoveryPipeline del edge, ejecutado en Node): no hay
//  plan inventado. Login real con la cuenta QA; sólo se intercepta la edge del acomodo.
// ============================================================================
const EMAIL = process.env.TEST_EMAIL; const PASS = process.env.TEST_PASSWORD;
const hayCreds = !!(EMAIL && PASS);
const CLAVE = 'costeador-vonhaucke-v1';

const PROG = (o) => ({ source: 'CONFIRMADO_PROGRAMA', sinPrecioAutorizado: true, product_status: 'RESOLVED', identity_status: 'RESOLVED', price_status: 'SNAPSHOT_DISPLAY', autoridad: 'SERVIDOR', ...o });
// Datos de prueba claramente identificados: GOLDEN_CLIENTE permite etiquetar la corrida (p. ej. post-deploy).
const CLIENTE_GOLDEN = process.env.GOLDEN_CLIENTE || 'Torre Sur (golden)';
// El id del presupuesto que deja esta prueba (lo lee golden757Edicion, que depende de este proyecto).
const GOLDEN_ID = 'test-results/golden757-ultimo.json';
const SEMILLA = {
  onboardingVisto: true,
  cotizacion: {
    cliente: CLIENTE_GOLDEN,
    partidas: [
      PROG({ id: 'operativo|ANCHOR_WORKSTATION|#0::op-8u-4800x1200-cristal', nombre: 'Módulo operativo App LT 8 usuarios (biombo cristal)', cantidad: 1, precioUnitario: 23070, precio_lista_snapshot: 23070, bancoId: 'op-8u-4800x1200-cristal', piezaId: 'op-8u-4800x1200-cristal', productoId: 1896, producto_version_id: 1139, rol: 'operativo', relation_role: 'ANCHOR_WORKSTATION', functional_group_id: 'fg:req:ÁREA OPERATIVA:operativo:0:#0', instance_id: 'inst:req:ÁREA OPERATIVA:operativo:0:#0', requirement_id: 'req:ÁREA OPERATIVA:operativo:0', zone_id: 'ÁREA OPERATIVA', w: 4800, d: 1200, user_capacity: 8 }),
      PROG({ id: 'privado|ANCHOR_DESK|#0::dir-1800x2400', nombre: 'Módulo directivo App LT', cantidad: 1, precioUnitario: 15780, precio_lista_snapshot: 15780, bancoId: 'dir-1800x2400', piezaId: 'dir-1800x2400', productoId: 1904, rol: 'privado', relation_role: 'ANCHOR_DESK', functional_group_id: 'fg:req:OFICINA CEO:privado:0:#0', instance_id: 'inst:req:OFICINA CEO:privado:0:#0', requirement_id: 'req:OFICINA CEO:privado:0', zone_id: 'OFICINA CEO', w: 1800, d: 2400 }),
      PROG({ id: 'juntas|ANCHOR_MEETING|#0::mj-900x900-melamina', nombre: 'Mesa de juntas', cantidad: 1, precioUnitario: 4260, precio_lista_snapshot: 4260, bancoId: 'mj-900x900-melamina', piezaId: 'mj-900x900-melamina', productoId: 1906, rol: 'juntas', relation_role: 'ANCHOR_MEETING', functional_group_id: 'fg:req:SALA DE CONSEJO:juntas:0:#0', instance_id: 'inst:req:SALA DE CONSEJO:juntas:0:#0', requirement_id: 'req:SALA DE CONSEJO:juntas:0', zone_id: 'SALA DE CONSEJO', w: 900, d: 900 }),
      PROG({ id: 'recepcion|ANCHOR_RECEPTION|#0::rec-2420x830', nombre: 'Módulo recepción 2 usuarios', cantidad: 1, precioUnitario: 29920, precio_lista_snapshot: 29920, bancoId: 'rec-2420x830', piezaId: 'rec-2420x830', productoId: 1905, rol: 'recepcion', relation_role: 'ANCHOR_RECEPTION', functional_group_id: 'fg:req:RECEPCIÓN:recepcion:0:#0', instance_id: 'inst:req:RECEPCIÓN:recepcion:0:#0', requirement_id: 'req:RECEPCIÓN:recepcion:0', zone_id: 'RECEPCIÓN', w: 2420, d: 830 }),
      PROG({ id: 'privado|EXECUTIVE_SEAT|inst:req:OFICINA CEO:privado:0:#0::silla-alpha', nombre: 'Silla directiva ALPHA', cantidad: 1, precioUnitario: 11950, precio_lista_snapshot: 11950, bancoId: 'silla-alpha', piezaId: 'silla-alpha', productoId: 1926, rol: 'privado', relation_role: 'EXECUTIVE_SEAT', anchor_role: 'ANCHOR_DESK', anchor_instance_id: 'inst:req:OFICINA CEO:privado:0:#0', functional_group_id: 'fg:req:OFICINA CEO:privado:0:#0' }),
      PROG({ id: 'juntas|MEETING_SEAT|inst:req:SALA DE CONSEJO:juntas:0:#0::silla-concerto', nombre: 'Silla CONCERTO (visita 4 pts)', cantidad: 4, precioUnitario: 5140, precio_lista_snapshot: 5140, bancoId: 'silla-concerto', piezaId: 'silla-concerto', productoId: 1925, rol: 'juntas', relation_role: 'MEETING_SEAT', anchor_role: 'ANCHOR_MEETING', anchor_instance_id: 'inst:req:SALA DE CONSEJO:juntas:0:#0', functional_group_id: 'fg:req:SALA DE CONSEJO:juntas:0:#0' }),
      { id: 'p-1', nombre: 'Banca doble APP LT 1.50 · 8 usuarios · ocupa 6.00 × 1.20 m', cantidad: 1, precioUnitario: 26145, origen: 'ia', productoId: 'banca_doble', piezaId: 'linea-banca_doble', w: 6000, d: 1200, confianza: 'alta', precioReal: true },
      { id: 'p-2', nombre: 'Eclipse Escritorio Directivo 2.10 m · mano Derecha', cantidad: 1, precioUnitario: 81470, origen: 'ia', productoId: 'escritorio', piezaId: 'linea-escritorio', w: 2100, d: 900, confianza: 'alta', precioReal: true },
      { id: 'p-3', nombre: 'Eclipse Credenza baja 2.10 × 0.60 m · mano Derecha', cantidad: 1, precioUnitario: 43720, origen: 'ia', productoId: 'credenza', piezaId: 'linea-credenza', w: 2100, d: 600, confianza: 'alta', precioReal: true },
      { id: 'p-4', nombre: 'Mesa de juntas APP LT 1.20 × 1.20', cantidad: 1, precioUnitario: 8214, origen: 'ia', productoId: 'mesa_juntas', piezaId: 'linea-mesa_juntas', w: 1200, d: 1200, confianza: 'alta', precioReal: true },
      { id: 'p-5', nombre: 'Mox · Gaveta pedestal 3 cajones · frentes melamina', cantidad: 8, precioUnitario: 2189, origen: 'ia', productoId: 'pedestal', piezaId: 'linea-pedestal', w: 380, d: 456, confianza: 'media', precioReal: true },
      { id: 'p-6', nombre: 'Modulor · Archivero horizontal 0.90 · 2 puertas · Melamina y canto ABS', cantidad: 1, precioUnitario: 7230, origen: 'ia', productoId: 'archivero_h', piezaId: 'linea-archivero_h', w: 749, d: 900, confianza: 'media', precioReal: true },
      { id: 'p-7', nombre: 'Silla operativa · WIN', cantidad: 8, precioUnitario: 5210, origen: 'banco', piezaId: 'p9-silla-operativa-win-5210', deBanco: true, precioReal: true },
      { id: 'p-8', nombre: 'Silla directiva ALPHA', cantidad: 1, precioUnitario: 11950, origen: 'banco', piezaId: 'silla-alpha', deBanco: true, precioReal: true },
      { id: 'p-9', nombre: 'Silla de visita · CONCERTO', cantidad: 2, precioUnitario: 5470, origen: 'banco', piezaId: 'p9-silla-de-visita-concerto-5470', deBanco: true, precioReal: true },
      { id: 'p-10', nombre: 'Silla · SONATA', cantidad: 4, precioUnitario: 2420, origen: 'banco', piezaId: 'p9-silla-sonata-2420-144', deBanco: true, precioReal: true },
      { id: 'p-11', nombre: 'Recepción (2420 × 830 mm)', cantidad: 1, precioUnitario: 29920, origen: 'banco', piezaId: 'p9-recepcion-29920', deBanco: true, precioReal: true },
      PROG({ id: 'juntas|MEETING_SEAT|inst:req:SALA DE CONSEJO:juntas:0:#0::silla-sonata', nombre: 'Silla SONATA (visita 4 pts)', cantidad: 4, precioUnitario: 2420, precio_lista_snapshot: 2420, bancoId: 'silla-sonata', piezaId: 'silla-sonata', productoId: 1928, rol: 'juntas', relation_role: 'MEETING_SEAT', anchor_role: 'ANCHOR_MEETING', anchor_instance_id: 'inst:req:SALA DE CONSEJO:juntas:0:#0', functional_group_id: 'fg:req:SALA DE CONSEJO:juntas:0:#0' }),
    ],
    acomodo: {
      planReal: true,
      areasM: [
        { nombre: 'OFICINA CEO', tipo: 'privado', ancho: 4, largo: 3.2, x: 0, y: 0, puestos: 1 },
        { nombre: 'SALA DE CONSEJO', tipo: 'juntas', ancho: 7, largo: 3.2, x: 8, y: 0 },   // (la lectura real de producción no traía asientos; con asientos:10 el panel propone mesa de 10 como conflicto, probado aparte)
        { nombre: 'ÁREA OPERATIVA', tipo: 'open', ancho: 8, largo: 3.2, x: 0, y: 3.2, puestos: 8 },
        { nombre: 'RECEPCIÓN', tipo: 'recepcion', ancho: 4, largo: 2.4, x: 0, y: 6.4 },
        { nombre: 'SITE (IT)', tipo: 'servicio', ancho: 4, largo: 2.4, x: 8, y: 6.4 },
        { nombre: 'SANITARIOS H', tipo: 'servicio', ancho: 3, largo: 3.2, x: 12, y: 3.2 },
        { nombre: 'SANITARIOS M', tipo: 'servicio', ancho: 3, largo: 2.4, x: 12, y: 6.4 },
      ],
    },
  },
};

const leerCot = (page) => page.evaluate((k) => { try { return JSON.parse(window.localStorage.getItem(k))?.cotizacion || null; } catch (_e) { return null; } }, CLAVE);
const rol = (ps, r) => ps.filter((p) => p.relation_role === r);

test.describe('GOLDEN 757 · plano → programa → VONI → fusión → acomodo real → guardar → reabrir', () => {
  test.skip(!hayCreds, 'Define TEST_EMAIL y TEST_PASSWORD.');
  test.setTimeout(180000);

  test('el proyecto de las capturas queda coherente de extremo a extremo', async ({ page }) => {
    const pageErrors = []; page.on('pageerror', (e) => pageErrors.push(String(e?.message || e)));
    page.on('console', (m) => { const t = m.text(); if (/\[unhandled\]/i.test(t)) console.log('[golden757][consola]', t.slice(0, 300)); });
    await page.addInitScript(() => { window.addEventListener('unhandledrejection', (e) => console.log('[unhandled]', String(e.reason?.stack || e.reason?.message || e.reason).slice(0, 400))); });
    const solverCalls = [];
    // SOLVER REAL del edge. Dos modos:
    //  · por omisión: recoveryPipeline del edge ejecutado en Node sobre el payload del cliente;
    //  · EDGE_RC_URL=http://localhost:8000 → la petición COMPLETA (JWT real, apikey, cuerpo) se
    //    reenvía al edge RC servido bajo Deno (mismo index.ts: auth real con Supabase + pipeline),
    //    y la respuesta del edge es la que recibe el cliente. Certificación del artefacto RC.
    const EDGE_RC = process.env.EDGE_RC_URL || null;
    //  · EDGE_REAL=1 → NO se intercepta: la petición va al edge DESPLEGADO (validación post-deploy).
    const EDGE_REAL = !!process.env.EDGE_REAL;
    let nubeOrigen = null; let nubeApikey = null;
    await page.route('**/functions/v1/acomodar-espacio-recovery', async (route) => {
      if (EDGE_REAL) {
        if (route.request().method() === 'POST') {
          try { solverCalls.push(route.request().postDataJSON()); nubeOrigen = new URL(route.request().url()).origin; nubeApikey = route.request().headers().apikey || nubeApikey; } catch (_e) {}
        }
        return route.continue();
      }
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
      const body = route.request().postDataJSON();
      solverCalls.push(body);
      try { nubeOrigen = new URL(route.request().url()).origin; nubeApikey = route.request().headers().apikey || nubeApikey; } catch (_e) {}
      if (EDGE_RC) {
        const h = route.request().headers();
        const r = await fetch(EDGE_RC, { method: 'POST', headers: { 'content-type': 'application/json', authorization: h.authorization || '', apikey: h.apikey || '' }, body: route.request().postData() });
        const txt = await r.text();
        console.log(`[golden757] edge RC (Deno) HTTP ${r.status} · ${txt.slice(0, 160)}`);
        return route.fulfill({ status: r.status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: txt });
      }
      const res = construirRespuestaAcomodo(body.areas || [], body.piezas || []);
      // ACOMODO_DUMP_DIR=/ruta → petición y respuesta completas para auditarlas fuera (igual que cotizarProyectos).
      if (process.env.ACOMODO_DUMP_DIR) { try { fs.mkdirSync(process.env.ACOMODO_DUMP_DIR, { recursive: true }); fs.writeFileSync(`${process.env.ACOMODO_DUMP_DIR}/golden757-${solverCalls.length}.json`, JSON.stringify({ peticion: body, respuesta: res }, null, 1)); } catch (_e) {} }
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(res) });
    });
    // Traza del guardado real (RPCs seguros): estado HTTP y respuesta de cada llamada.
    const guardados = [];
    page.on('request', (req) => { if (/\/rest\/v1\/rpc\/(crear|actualizar)_cotizacion_segura/.test(req.url())) console.log('[golden757] petición', req.url().split('/rpc/')[1], 'bytes', (req.postData() || '').length, new Date().toISOString()); });
    page.on('requestfailed', (req) => { if (/supabase|rpc/.test(req.url())) console.log('[golden757] petición FALLÓ', req.url().slice(0, 120), req.failure()?.errorText); });
    page.on('response', async (res) => {
      const u = res.url();
      if (!/\/rest\/v1\/rpc\/(crear|actualizar)_cotizacion_segura/.test(u)) return;
      const txt = await res.text().catch(() => '');
      guardados.push({ rpc: u.split('/rpc/')[1], status: res.status(), body: txt.slice(0, 200) });
      console.log('[golden757] guardado', u.split('/rpc/')[1], 'HTTP', res.status(), txt.slice(0, 200));
    });
    await page.addInitScript(([k, v]) => { try { if (!window.localStorage.getItem(k)) window.localStorage.setItem(k, JSON.stringify(v)); } catch (_e) {} }, [CLAVE, SEMILLA]);
    await page.goto('/');
    await page.fill('#email-login', EMAIL); await page.fill('#pass-login', PASS);
    await page.getByRole('button', { name: /^Entrar$/i }).click();
    await expect(page.getByRole('button', { name: /Salir/i })).toBeVisible({ timeout: 20000 });
    expect((await leerCot(page)).partidas).toHaveLength(18);

    // 1) COTIZAR → Muebles: el panel enseña los duplicados ANTES de tocar nada y ofrece fusionarlos.
    await page.getByTestId('home-cotizar').click();
    await page.getByTestId('voni-paso-muebles').click();
    // PILOTO AUTOMÁTICO (12-oct): si no hay nada que decidir, la fusión ya ocurrió sola y el panel
    // lo dice; si hubiera algo que decidir, el panel de duplicados sigue ahí para la persona.
    await expect(page.getByTestId('piloto-programa').or(page.getByTestId('duplicados-programa')).first()).toBeVisible({ timeout: 15000 });
    const piloto = await page.getByTestId('piloto-programa').count();
    if (!piloto) await expect(page.getByText(/Banca doble APP LT.*sustituye a/i)).toBeVisible();
    {
      const antesClick = (await leerCot(page)).partidas;
      const { reconciliarNuevasConPrograma } = await import('../src/datos/reconciliarPartidas.js');
      const r = reconciliarNuevasConPrograma(antesClick.filter((p) => p.source === 'CONFIRMADO_PROGRAMA'), antesClick.filter((p) => p.source !== 'CONFIRMADO_PROGRAMA'));
      console.log('[golden757] conciliación (Node, estado del navegador):', JSON.stringify(r.sustituidas.map((x) => [x.de, x.a])), 'ambiguas', JSON.stringify(r.ambiguas));
      console.log('[golden757] p-10:', JSON.stringify(antesClick.find((p) => p.id === 'p-10')));
      // Con el piloto el panel ya no existe: innerText SIN timeout esperaría para siempre (hasta el timeout del test).
      console.log('[golden757] panel:', (await page.getByTestId('duplicados-programa').innerText({ timeout: 1500 }).catch(() => 'sin panel (piloto)')).slice(0, 600));
    }
    const boton = page.getByRole('button', { name: /Fusionar \d+ duplicado|Aplicar programa detectado|Vincular lo que ya tengo/i });
    if (await boton.count() && await boton.first().isEnabled().catch(() => false)) await boton.first().click();

    // 2) CERO duplicados injustificados: un ancla por rol; las sillas del usuario atadas a su ancla.
    await expect.poll(async () => (await leerCot(page)).partidas.length, { timeout: 10000 }).toBeLessThan(18);
    const ps = (await leerCot(page)).partidas;
    expect(rol(ps, 'ANCHOR_WORKSTATION')).toHaveLength(1);
    expect(rol(ps, 'ANCHOR_WORKSTATION')[0].id).toBe('p-1');                          // la banca que describió la persona
    expect(rol(ps, 'ANCHOR_WORKSTATION')[0].user_capacity).toBe(8);
    expect(rol(ps, 'ANCHOR_DESK')).toHaveLength(1); expect(rol(ps, 'ANCHOR_DESK')[0].id).toBe('p-2');
    expect(rol(ps, 'ANCHOR_MEETING')).toHaveLength(1); expect(rol(ps, 'ANCHOR_MEETING')[0].id).toBe('p-4');
    expect(rol(ps, 'ANCHOR_RECEPTION')).toHaveLength(1); expect(rol(ps, 'ANCHOR_RECEPTION')[0].id).toBe('p-11');
    expect(ps.filter((p) => /ALPHA/i.test(p.nombre))).toHaveLength(1);
    expect(ps.filter((p) => /WIN/i.test(p.nombre)).reduce((n, p) => n + p.cantidad, 0)).toBe(8);
    console.log('[golden757] tras fusión:', JSON.stringify(ps.map((p) => [p.id.slice(0, 40), p.nombre.slice(0, 30), p.cantidad, p.relation_role || null, p.source || null])));
    expect(ps.filter((p) => p.source === 'CONFIRMADO_PROGRAMA' && /SONATA|CONCERTO/.test(p.nombre)).length).toBeLessThanOrEqual(1);
    // 2026-10-16: el programa traía el MISMO lugar repetido (4 CONCERTO + 4 SONATA para la mesa de 4). Las 4 SONATA
    // de la persona lo cubren: 4 sillas de juntas cobradas, no 8, y ninguna CONCERTO del programa.
    expect(rol(ps, 'MEETING_SEAT').reduce((n, p) => n + p.cantidad, 0)).toBe(4);
    expect(ps.filter((p) => p.source === 'CONFIRMADO_PROGRAMA' && /CONCERTO/.test(p.nombre))).toHaveLength(0);
    expect(ps.find((p) => p.id === 'p-8').anchor_instance_id).toBeTruthy();         // ALPHA atada al escritorio
    expect(ps.find((p) => p.id === 'p-1').precioUnitario).toBe(26145);              // precio intacto
    // "Esto entendí": ya no sobran sillas de trabajo.
    await expect(page.getByText(/sobran \d+/)).toHaveCount(0);
    // Aplicar de nuevo es idempotente.
    const antes = JSON.stringify((await leerCot(page)).partidas.map((p) => [p.id, p.cantidad]).sort());
    // Tras fusionar, el panel ya no ofrece nada que fusionar: si aún hubiera botón, pulsarlo no cambia nada.
    const otra = page.getByRole('button', { name: /Fusionar \d+ duplicado|Aplicar programa detectado|Vincular lo que ya tengo/i });
    if ((await otra.count()) > 0 && (await otra.first().isEnabled().catch(() => false))) { await otra.first().click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(500); }
    expect(JSON.stringify((await leerCot(page)).partidas.map((p) => [p.id, p.cantidad]).sort())).toBe(antes);

    // 3) ACOMODO con el solver real: la banca va con su huella 6000×1200 y la mayoría se coloca.
    const stepAcomodo = page.getByTestId('voni-paso-acomodo');
    await expect(stepAcomodo).toBeEnabled({ timeout: 15000 });
    await stepAcomodo.click();
    await page.waitForTimeout(800);
    console.log('[golden757] pasos:', JSON.stringify(await page.locator('.voni-paso').evaluateAll((els) => els.map((e) => [e.className, e.disabled]))));
    await page.screenshot({ path: process.env.GOLDEN_SHOT || 'test-results/golden757-acomodo.png', fullPage: true });
    await expect(page.getByText(/Tu espacio en 3D|Acomodo en revisión|Dónde va cada cosa/).first()).toBeVisible({ timeout: 15000 });
    // El acomodo se dispara con el botón "Acomodar" (no solo al entrar al paso).
    const acomodar = page.getByTestId('acomodo-acomodar');
    await expect(acomodar).toBeVisible({ timeout: 15000 });
    await expect(acomodar, 'el programa debe estar listo (bench + sillas + mesa) para poder acomodar').toBeEnabled({ timeout: 15000 });
    await acomodar.click();
    await expect.poll(() => solverCalls.length, { timeout: 45000 }).toBeGreaterThanOrEqual(1);
    const payload = solverCalls[0];
    const banca = payload.piezas.find((p) => p.id === 'p-1-1');
    expect([banca.w, banca.d]).toEqual([6000, 1200]);
    expect(banca.relation_role).toBe('ANCHOR_WORKSTATION');
    expect(payload.piezas.every((p) => typeof p.relation_role === 'string')).toBe(true);
    expect(payload.piezas.some((p) => p.id.startsWith('p-5-'))).toBe(false);          // gavetas: bajo cubierta, no piso
    await expect.poll(async () => (await leerCot(page))?.acomodo?.plan?.colocacion?.length || 0, { timeout: 45000 }).toBeGreaterThan(9);
    const cot = await leerCot(page);
    const colocadas = cot.acomodo.plan.colocacion.length;
    console.log(`[golden757] piezas al solver: ${payload.piezas.length} · colocadas: ${colocadas} (antes en producción: 9 de 34)`);
    expect(cot.acomodo.plan.colocacion.some((c) => c.id === 'p-1-1')).toBe(true);     // la banca se colocó
    // Cero invariantes geométricos duros (solapes, fuera de bounds, puertas, obstáculos) en el veredicto del edge.
    const issuesDuros = (cot.acomodo.plan.layoutSpec?.validation?.issues || []).filter((i) => i.severity === 'fail');
    expect(issuesDuros, JSON.stringify(issuesDuros)).toHaveLength(0);
    console.log('[golden757] status', cot.acomodo.plan.layoutSpec?.status, '· no cupieron:', JSON.stringify((cot.acomodo.plan.no_cupieron || []).map((u) => [u.anchorId, u.piezas, u.invariante])), '· unassigned:', JSON.stringify(cot.acomodo.plan.unassigned || []));
    // VH-119: el ejecutivo va DETRÁS del escritorio con su franja de acceso y las visitas al frente. En la
    // OFICINA CEO de 4.0 × 3.2 m (escritorio 2.10 + credenza 2.10 + archivero 0.90 + 3 sillas) con el pasillo de
    // 1 m entre kits, el candidato que coloca la credenza (20) deja sillas pegadas al muro en otros cuartos
    // (semántica FAIL) y el selector prefiere el candidato semánticamente limpio: 19 colocadas, credenza y
    // archivero reportados como "no cupo" (antes 21 con el ejecutivo sentado junto a sus visitas, que el juez
    // rechazaba). Decisión pendiente de Dirección (§ Fase 8): pasillo de 1 m en privados chicos / selección por área.
    expect(cot.acomodo.plan.colocacion.length).toBeGreaterThanOrEqual(19);
    expect((cot.acomodo.plan.layoutSpec?.validation?.semantic_gate?.sem_status || '')).toBe('PASS');
    const ejecutivo = cot.acomodo.plan.colocacion.find((c) => c.id === 'p-8-1');
    expect(ejecutivo?.side, 'la silla directiva queda detrás del escritorio').toBe('BACK');
    // Las SONATA restantes: razón exacta.
    // 2026-10-16: con TODO colocado el panel de diagnóstico no existe; innerText SIN timeout esperaba hasta el
    // tope del test (180 s). Se lee con timeout corto y se exige que las 4 SONATA de la persona queden sentadas.
    const diag = await page.getByTestId('diagnostico-acomodo').innerText({ timeout: 1500 }).catch(() => '');
    expect(cot.acomodo.plan.colocacion.filter((c) => /^p-10-/.test(c.id)), 'las 4 SONATA de la persona quedan sentadas en la mesa').toHaveLength(4);
    console.log('[golden757] no colocadas + diagnóstico:', JSON.stringify(((await leerCot(page))?.acomodo?.plan?.unassigned || (await leerCot(page))?.acomodo?.plan?.no_cupieron || []).map((u) => [u.id, u.reason_code || u.code || u.reason || null])), '·', diag.replace(/\s+/g, ' ').slice(0, 500));
    if (colocadas < payload.piezas.length) expect(diag).toMatch(/MISSING_ANCHOR/);
    // Lo que no cupo tiene diagnóstico por pieza, sin "juntass" ni "capacidad del catálogo".
    const cuerpo = await page.locator('main').innerText();
    expect(cuerpo).not.toMatch(/juntass/);
    expect(cuerpo).not.toMatch(/capacidad del catálogo/);
    if (colocadas < payload.piezas.length) await expect(page.getByTestId('diagnostico-acomodo')).toBeVisible();

    // 4) GUARDAR (persistencia REAL): el autosave (1.5 s) manda la cotización a la nube; se lee de
    //    vuelta por el RPC seller-safe `cotizacion_segura` con el JWT de la sesión y debe traer las
    //    MISMAS 12 partidas y el plan con las mismas colocadas.
    const firmaDe = (ps) => JSON.stringify((ps || []).map((p) => [p.id, p.cantidad, p.relation_role ?? null]).sort());
    const firma = firmaDe(cot.partidas);
    await expect.poll(async () => (await leerCot(page))?.id || null, { timeout: 20000 }).not.toBeNull();
    const idNube = (await leerCot(page)).id;
    expect(nubeOrigen && nubeApikey, 'origen/apikey de la nube capturados del tráfico real').toBeTruthy();
    const leerNube = () => page.evaluate(async ([origen, apikey, id]) => {
      const k = Object.keys(window.localStorage).find((x) => /^sb-.*-auth-token$/.test(x));
      const tok = k ? (JSON.parse(window.localStorage.getItem(k) || '{}').access_token || null) : null;
      const r = await fetch(`${origen}/rest/v1/rpc/cotizacion_segura`, { method: 'POST', headers: { 'content-type': 'application/json', apikey, authorization: `Bearer ${tok}` }, body: JSON.stringify({ p_id: id }) });
      const j = await r.json().catch(() => null);
      return { status: r.status, partidas: j?.partidas || null, colocadas: j?.acomodo?.plan?.colocacion?.length ?? null, cliente: j?.cliente ?? null, activa: j?.activa ?? null };
    }, [nubeOrigen, nubeApikey, idNube]);
    {
      const raw = (k) => page.evaluate((kk) => window.localStorage.getItem(kk) || '', k);
      const a = await raw(CLAVE); await page.waitForTimeout(2000); const b = await raw(CLAVE);
      if (a !== b) {
        const A = JSON.parse(a).cotizacion, B = JSON.parse(b).cotizacion;
        const difs = Object.keys({ ...A, ...B }).filter((k) => JSON.stringify(A[k]) !== JSON.stringify(B[k]));
        const difsAc = Object.keys({ ...(A.acomodo || {}), ...(B.acomodo || {}) }).filter((k) => JSON.stringify(A.acomodo?.[k]) !== JSON.stringify(B.acomodo?.[k]));
        const PA = A.acomodo?.plan || {}, PB = B.acomodo?.plan || {};
        const difsPlan = Object.keys({ ...PA, ...PB }).filter((k) => JSON.stringify(PA[k]) !== JSON.stringify(PB[k]));
        console.log('[golden757] solverCalls hasta ahora:', solverCalls.length, new Date().toISOString());
        console.log('[golden757] estado.cotizacion CAMBIA solo cada <2 s · claves:', JSON.stringify(difs), 'acomodo:', JSON.stringify(difsAc), 'plan:', JSON.stringify(difsPlan), difsPlan.map((k) => `${k}: ${JSON.stringify(PA[k]).slice(0, 120)} → ${JSON.stringify(PB[k]).slice(0, 120)}`).join(' | ').slice(0, 900));
      } else console.log('[golden757] estado.cotizacion estable 2 s', new Date().toISOString(), 'solverCalls', solverCalls.length);
    }
    await expect.poll(async () => (await leerNube()).colocadas, { timeout: 30000, message: 'el plan del acomodo llega a la nube' }).toBe(colocadas);
    const enNube = await leerNube();
    console.log('[golden757] nube: id', idNube, 'HTTP', enNube.status, 'partidas', enNube.partidas?.length, 'colocadas', enNube.colocadas);
    expect(enNube.status).toBe(200);
    expect(enNube.cliente).toBe(CLIENTE_GOLDEN);
    expect(enNube.partidas).toHaveLength(cot.partidas.length);
    expect(firmaDe(enNube.partidas)).toBe(firma);
    // golden757Edicion (proyecto dependiente) edita EXACTAMENTE este presupuesto: se deja su id, nada de "el más reciente".
    fs.mkdirSync('test-results', { recursive: true });
    fs.writeFileSync(GOLDEN_ID, JSON.stringify({ id: idNube, cliente: CLIENTE_GOLDEN, colocadas, en: new Date().toISOString() }));

    // 5) REABRIR desde otra computadora: se vacía el estado local, se recarga y se abre el presupuesto
    //    desde "Presupuestos anteriores" (RPC `cotizacion_segura`) → mismas partidas y mismo acomodo.
    await page.evaluate(([k, v]) => window.localStorage.setItem(k, JSON.stringify(v)), [CLAVE, { onboardingVisto: true, cotizacion: { partidas: [] } }]);
    await page.reload();
    await expect(page.getByRole('button', { name: /Salir/i })).toBeVisible({ timeout: 20000 });
    expect((await leerCot(page))?.partidas || []).toHaveLength(0);
    await page.getByText('Presupuestos anteriores', { exact: false }).first().click();
    // La tarjeta de UN presupuesto (la lista entera también es `.tarjeta`): la que tiene su fila de botones.
    const tarjeta = page.locator('.tarjeta:has(> .fila-botones)', { hasText: CLIENTE_GOLDEN }).first();
    await expect(tarjeta).toBeVisible({ timeout: 20000 });
    await tarjeta.getByRole('button', { name: /^Abrir$/ }).click();
    await expect.poll(async () => (await leerCot(page))?.partidas?.length || 0, { timeout: 20000 }).toBe(cot.partidas.length);
    const cot2 = await leerCot(page);
    expect(cot2.id).toBe(idNube);
    expect(firmaDe(cot2.partidas)).toBe(firma);
    expect(cot2.acomodo?.plan?.colocacion?.length ?? 0).toBe(colocadas);
    // Reabierto no reescribe la nube solo (no cambió nada): la fila sigue igual.
    const enNube2 = await leerNube();
    expect(firmaDe(enNube2.partidas)).toBe(firma);
    expect(enNube2.colocadas).toBe(colocadas);

    // 6) LIMPIEZA OPCIONAL (sólo con GOLDEN_LIMPIAR=1, p. ej. en local con nube propia): la prueba saca de
    //    la lista SU presupuesto con la función de la app ("Sacar de la lista" = `activa=false`, reversible)
    //    y la misma cuenta que lo creó. Por omisión NO se toca ningún registro: contra producción, Dirección
    //    pidió datos de prueba identificados sin limpieza (la fila queda como evidencia).
    if (process.env.GOLDEN_LIMPIAR === '1') {
      page.once('dialog', (d) => d.accept());
      await page.goto('/');
      await page.getByText('Presupuestos anteriores', { exact: false }).first().click();
      const mia = page.locator('.tarjeta:has(> .fila-botones)', { hasText: CLIENTE_GOLDEN }).first();
      await expect(mia).toBeVisible({ timeout: 20000 });
      await mia.getByRole('button', { name: /Sacar de la lista/ }).click();
      await expect.poll(async () => (await leerNube()).activa, { timeout: 15000, message: 'la fila del golden queda inactiva' }).toBe(false);
      console.log('[golden757] limpieza: fila', idNube, 'activa=false (por la app, cuenta QA)');
    }
    expect(pageErrors, pageErrors.join('\n')).toHaveLength(0);
  });
});
