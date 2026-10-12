import { test, expect } from '@playwright/test';
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
const SEMILLA = {
  onboardingVisto: true,
  cotizacion: {
    cliente: 'Torre Sur (golden)',
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
        { nombre: 'SALA DE CONSEJO', tipo: 'juntas', ancho: 7, largo: 3.2, x: 8, y: 0, asientos: 10 },
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
    const solverCalls = [];
    // SOLVER REAL del edge (recoveryPipeline) corriendo en Node sobre el payload que manda el cliente.
    await page.route('**/functions/v1/acomodar-espacio-recovery', async (route) => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
      const body = route.request().postDataJSON();
      solverCalls.push(body);
      const res = construirRespuestaAcomodo(body.areas || [], body.piezas || []);
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(res) });
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
    await expect(page.getByText(/Programa detectado del plano/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('duplicados-programa')).toBeVisible();
    await expect(page.getByText(/Banca doble APP LT.*sustituye a/i)).toBeVisible();
    const boton = page.getByRole('button', { name: /Fusionar \d+ duplicado|Aplicar programa detectado|Vincular lo que ya tengo/i });
    await expect(boton).toBeEnabled();
    await boton.click();

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
    expect(ps.filter((p) => p.source === 'CONFIRMADO_PROGRAMA' && /SONATA|CONCERTO/.test(p.nombre)).length).toBeLessThanOrEqual(1);
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
    // Lo que no cupo tiene diagnóstico por pieza, sin "juntass" ni "capacidad del catálogo".
    const cuerpo = await page.locator('main').innerText();
    expect(cuerpo).not.toMatch(/juntass/);
    expect(cuerpo).not.toMatch(/capacidad del catálogo/);
    if (colocadas < payload.piezas.length) await expect(page.getByTestId('diagnostico-acomodo')).toBeVisible();

    // 4) GUARDAR / REABRIR: recarga → mismas partidas y mismo acomodo.
    const firma = JSON.stringify(cot.partidas.map((p) => [p.id, p.cantidad, p.relation_role]).sort());
    await page.reload();
    await expect(page.getByRole('button', { name: /Salir/i })).toBeVisible({ timeout: 20000 });
    const cot2 = await leerCot(page);
    expect(JSON.stringify(cot2.partidas.map((p) => [p.id, p.cantidad, p.relation_role]).sort())).toBe(firma);
    expect(cot2.acomodo.plan.colocacion.length).toBe(colocadas);
    expect(pageErrors, pageErrors.join('\n')).toHaveLength(0);
  });
});
