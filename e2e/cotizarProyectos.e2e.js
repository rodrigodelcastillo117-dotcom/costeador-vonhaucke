import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { construirRespuestaAcomodo } from '../supabase/functions/acomodar-espacio-recovery/recoveryPipeline.js';

// ============================================================================
//  CERTIFICACIÓN COTIZAR · tres proyectos distintos al golden 757 (Prioridad 5).
//  Cada proyecto: identidad de productos y sin duplicados tras aplicar el programa del plano,
//  acomodo con el pipeline REAL del edge (en Node), cero invariantes duras, dependientes con su
//  ancla, guardado real en la nube (RPC seller-safe), reapertura desde el Archivo idéntica y PDF
//  preliminar descargable. No se emite nada. Datos de prueba identificados por nombre.
// ============================================================================
const EMAIL = process.env.TEST_EMAIL; const PASS = process.env.TEST_PASSWORD;
const CLAVE = 'costeador-vonhaucke-v1';
const SUFIJO = process.env.GOLDEN_SUFIJO || '';
const L = (id, nombre, cantidad, precio, extra = {}) => ({ id, nombre, cantidad, precioUnitario: precio, origen: 'ia', confianza: 'alta', precioReal: true, ...extra });
const PROYECTOS = [
  {
    clave: 'multizona', cliente: `PRUEBA multizona · 2 salas + 2 despachos${SUFIJO}`,
    partidas: [
      L('m-1', 'Mesa de juntas APP LT 2.40 × 1.20', 2, 9800, { productoId: 'mesa_juntas', piezaId: 'linea-mesa_juntas', w: 2400, d: 1200 }),
      L('s-1', 'Silla · SONATA', 16, 2420, { origen: 'banco', piezaId: 'p9-silla-sonata-2420-144', deBanco: true }),
      L('e-1', 'Eclipse Escritorio Directivo 2.10 m · mano Derecha', 2, 81470, { productoId: 'escritorio', piezaId: 'linea-escritorio', w: 2100, d: 900 }),
      L('a-1', 'Silla directiva ALPHA', 2, 11950, { origen: 'banco', piezaId: 'silla-alpha', deBanco: true }),
      L('v-1', 'Silla de visita · CONCERTO', 4, 5470, { origen: 'banco', piezaId: 'p9-silla-de-visita-concerto-5470', deBanco: true }),
    ],
    areasM: [
      { nombre: 'SALA DE JUNTAS A', tipo: 'juntas', ancho: 6, largo: 4, x: 0, y: 0 },
      { nombre: 'SALA DE JUNTAS B', tipo: 'juntas', ancho: 6, largo: 4, x: 7, y: 0 },
      { nombre: 'DESPACHO 1', tipo: 'privado', ancho: 4.5, largo: 4, x: 0, y: 5, puestos: 1 },
      { nombre: 'DESPACHO 2', tipo: 'privado', ancho: 4.5, largo: 4, x: 7, y: 5, puestos: 1 },
    ],
    piezasEsperadas: 26, minColocadas: 22, anclas: { ANCHOR_MEETING: 2, ANCHOR_DESK: 2 },
  },
  {
    clave: 'openplan', cliente: `PRUEBA open plan · 2 bancas + recepción${SUFIJO}`,
    partidas: [
      L('b-1', 'Banca doble APP LT 1.50 · 8 usuarios · ocupa 6.00 × 1.20 m', 2, 26145, { productoId: 'banca_doble', piezaId: 'linea-banca_doble', w: 6000, d: 1200 }),
      L('w-1', 'Silla operativa · WIN', 16, 5210, { origen: 'banco', piezaId: 'p9-silla-operativa-win-5210', deBanco: true }),
      L('g-1', 'Mox · Gaveta pedestal 3 cajones · frentes melamina', 16, 2189, { productoId: 'pedestal', piezaId: 'linea-pedestal', w: 380, d: 456, confianza: 'media' }),
      L('r-1', 'Recepción (2420 × 830 mm)', 1, 29920, { origen: 'banco', piezaId: 'p9-recepcion-29920', deBanco: true }),
      L('v-1', 'Silla de visita · CONCERTO', 2, 5470, { origen: 'banco', piezaId: 'p9-silla-de-visita-concerto-5470', deBanco: true }),
    ],
    areasM: [
      { nombre: 'ÁREA OPERATIVA', tipo: 'open', ancho: 14, largo: 7, x: 0, y: 0, puestos: 16 },
      { nombre: 'RECEPCIÓN', tipo: 'recepcion', ancho: 5, largo: 3.5, x: 0, y: 8 },
    ],
    piezasEsperadas: 21, minColocadas: 21, anclas: { ANCHOR_WORKSTATION: 2, ANCHOR_RECEPTION: 1 },
  },
  {
    clave: 'despacho', cliente: `PRUEBA despacho único${SUFIJO}`,
    partidas: [
      L('e-1', 'Eclipse Escritorio Directivo 2.10 m · mano Derecha', 1, 81470, { productoId: 'escritorio', piezaId: 'linea-escritorio', w: 2100, d: 900 }),
      L('c-1', 'Eclipse Credenza baja 2.10 × 0.60 m · mano Derecha', 1, 43720, { productoId: 'credenza', piezaId: 'linea-credenza', w: 2100, d: 600 }),
      L('a-1', 'Silla directiva ALPHA', 1, 11950, { origen: 'banco', piezaId: 'silla-alpha', deBanco: true }),
      L('v-1', 'Silla de visita · CONCERTO', 2, 5470, { origen: 'banco', piezaId: 'p9-silla-de-visita-concerto-5470', deBanco: true }),
    ],
    areasM: [{ nombre: 'OFICINA DIRECCIÓN', tipo: 'privado', ancho: 4.5, largo: 4, x: 0, y: 0, puestos: 1 }],
    piezasEsperadas: 5, minColocadas: 5, anclas: { ANCHOR_DESK: 1 },
  },
];
const leerCot = (page) => page.evaluate((k) => { try { return JSON.parse(window.localStorage.getItem(k))?.cotizacion || null; } catch (_e) { return null; } }, CLAVE);
const rol = (ps, r) => ps.filter((p) => p.relation_role === r);

test.describe('COTIZAR · tres proyectos', () => {
  test.skip(!(EMAIL && PASS), 'Define TEST_EMAIL y TEST_PASSWORD.');
  for (const P of PROYECTOS) {
    test(`${P.clave}: programa sin duplicados → acomodo real → nube → reabrir → PDF`, async ({ page }) => {
      test.setTimeout(240000);
      const pageErrors = []; page.on('pageerror', (e) => pageErrors.push(String(e?.message || e)));
      const solverCalls = []; let nubeOrigen = null; let nubeApikey = null; let ultima = null;
      // EDGE_RC_URL=http://localhost:8000/ → la petición COMPLETA (JWT real, apikey, cuerpo) va al edge RC servido
      // con Deno (mismo index.ts: autenticación real + pipeline). Sin la variable: pipeline del edge en Node.
      const EDGE_RC = process.env.EDGE_RC_URL || null;
      // EDGE_REAL=1 → NO se intercepta: la petición va al edge DESPLEGADO (certificación post-deploy, igual que golden757).
      const EDGE_REAL = !!process.env.EDGE_REAL;
      if (EDGE_REAL) page.on('response', async (res) => {
        if (!/\/functions\/v1\/acomodar-espacio-recovery/.test(res.url()) || res.request().method() !== 'POST') return;
        const txt = await res.text().catch(() => ''); try { ultima = JSON.parse(txt); } catch (_e) { ultima = null; }
        console.log(`[${P.clave}] edge REAL HTTP ${res.status()} · status ${ultima?.layoutSpec?.status} · colocadas ${ultima?.plan?.colocacion?.length}`);
      });
      await page.route('**/functions/v1/acomodar-espacio-recovery', async (route) => {
        if (EDGE_REAL) {
          if (route.request().method() === 'POST') { try { solverCalls.push(route.request().postDataJSON()); nubeOrigen = new URL(route.request().url()).origin; nubeApikey = route.request().headers().apikey || nubeApikey; } catch (_e) {} }
          return route.continue();
        }
        if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
        const body = route.request().postDataJSON(); solverCalls.push(body);
        try { nubeOrigen = new URL(route.request().url()).origin; nubeApikey = route.request().headers().apikey || nubeApikey; } catch (_e) {}
        if (EDGE_RC) {
          const h = route.request().headers();
          const r = await fetch(EDGE_RC, { method: 'POST', headers: { 'content-type': 'application/json', authorization: h.authorization || '', apikey: h.apikey || '' }, body: route.request().postData() });
          const txt = await r.text(); ultima = JSON.parse(txt);
          console.log(`[${P.clave}] edge RC (Deno) HTTP ${r.status} · status ${ultima?.layoutSpec?.status} · colocadas ${ultima?.plan?.colocacion?.length}`);
          return route.fulfill({ status: r.status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: txt });
        }
        ultima = construirRespuestaAcomodo(body.areas || [], body.piezas || []);
        return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(ultima) });
      });
      const semilla = { onboardingVisto: true, cotizacion: { cliente: P.cliente, partidas: P.partidas, acomodo: { planReal: true, areasM: P.areasM } } };
      await page.addInitScript(([k, v]) => { try { if (!window.localStorage.getItem(k)) window.localStorage.setItem(k, JSON.stringify(v)); } catch (_e) {} }, [CLAVE, semilla]);
      await page.goto('/');
      await page.fill('#email-login', EMAIL); await page.fill('#pass-login', PASS);
      await page.getByRole('button', { name: /^Entrar$/i }).click();
      await expect(page.getByRole('button', { name: /Salir/i })).toBeVisible({ timeout: 20000 });
      const n0 = (await leerCot(page)).partidas.length;

      // 1) Muebles: si el programa del plano propone/vincula, se aplica; nunca debe duplicar un ancla.
      await page.getByTestId('home-cotizar').click();
      await page.getByTestId('voni-paso-muebles').click();
      await page.waitForTimeout(800);
      const boton = page.getByRole('button', { name: /Fusionar \d+ duplicado|Aplicar programa detectado|Vincular lo que ya tengo/i });
      if (await boton.count() && await boton.first().isEnabled().catch(() => false)) {
        await boton.first().click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(800);
      }
      // VH-116: si una fila-ancla con cantidad > 1 podría cubrir varias zonas, la app NO reparte sola: pide decisión.
      // La persona decide "Repartir: una por zona" (un clic por fila ambigua).
      for (let k = 0; k < 4; k++) {
        const repartir = page.getByTestId('ambigua-repartir');
        if (!(await repartir.count())) break;
        const resumen = (ps) => ps.map((p) => [p.id, p.nombre?.slice(0, 22), p.cantidad, p.source || null, p.relation_role || null, p.requirement_id || null, p.zone_id || null]);
        const antes = (await leerCot(page)).partidas;
        const fila = await page.getByTestId('ambigua-programa').first().getAttribute('data-id');
        console.log(`[${P.clave}] decido repartir fila ${fila} · antes:`, JSON.stringify(resumen(antes)));
        await repartir.first().click();
        try {
          // Repartir consume una instancia del programa y agrega una fila: el conteo puede no cambiar.
          // Lo que debe desaparecer es la ambigüedad de ESA fila; y la cantidad total de ese ancla se conserva.
          await expect.poll(async () => page.locator(`[data-testid="ambigua-programa"][data-id="${fila}"]`).count(), { timeout: 10000 }).toBe(0);
          const despues = (await leerCot(page)).partidas;
          const unidades = (ps, id) => ps.filter((p) => String(p.id) === id || String(p.id).startsWith(`${id}#`)).reduce((n, p) => n + (Number(p.cantidad) || 1), 0);
          expect(unidades(despues, fila)).toBe(unidades(antes, fila));
          console.log(`[${P.clave}] repartida ${fila} · después:`, JSON.stringify(resumen(despues.filter((p) => String(p.id).startsWith(fila)))));
        } catch (e) {
          console.log(`[${P.clave}] SIN CAMBIO tras repartir ${fila} · después:`, JSON.stringify(resumen((await leerCot(page)).partidas)));
          throw e;
        }
        await page.waitForTimeout(500);
      }
      console.log(`[${P.clave}] ambiguas pendientes tras decidir:`, await page.getByTestId('ambigua-programa').count());
      const ps = (await leerCot(page)).partidas;
      // Dos filas con el mismo nombre sólo son duplicado si apuntan a la MISMA instancia/zona (una mesa
      // por sala repartida por conciliación es legítima: VH-116).
      const llaves = ps.map((p) => `${p.nombre}|${p.instance_id || p.zone_id || ''}`);
      expect(new Set(llaves).size, 'sin partidas duplicadas (mismo nombre y misma instancia/zona)').toBe(llaves.length);
      console.log(`[${P.clave}] tras programa:`, JSON.stringify(ps.map((p) => [p.id, p.nombre.slice(0, 28), p.cantidad, p.relation_role || null, p.instance_id || null, p.anchor_instance_id || null, p.user_capacity || null])));
      for (const [r, n] of Object.entries(P.anclas)) {
        const filas = rol(ps, r);
        const cantidad = filas.reduce((s, p) => s + (Number(p.cantidad) || 1), 0);
        if (filas.length) expect(cantidad, `${r} = ${n} unidades, no duplicadas`).toBe(n);
      }
      expect(ps.length, 'aplicar el programa no infla la cotización').toBeLessThanOrEqual(n0 + 2);
      await expect(page.locator('main')).not.toContainText(/sobran \d+/i);

      // 2) Acomodo con el solver real (Node).
      await page.getByTestId('voni-paso-acomodo').click();
      const acomodar = page.getByTestId('acomodo-acomodar');
      await expect(acomodar).toBeVisible({ timeout: 20000 });
      await acomodar.click();
      await expect.poll(async () => (await leerCot(page))?.acomodo?.plan?.colocacion?.length || 0, { timeout: 60000 }).toBeGreaterThan(0);
      const cot = await leerCot(page);
      const payload = solverCalls[solverCalls.length - 1];
      const colocadas = cot.acomodo.plan.colocacion.length;
      const fails = (cot.acomodo.plan.layoutSpec?.validation?.issues || []).filter((i) => i.severity === 'fail');
      console.log(`[${P.clave}] partidas ${ps.length} · piezas al solver ${payload.piezas.length} · colocadas ${colocadas} · status ${cot.acomodo.plan.layoutSpec?.status} · unassigned ${JSON.stringify(cot.acomodo.plan.unassigned || [])} · fails ${fails.length}`);
      // ACOMODO_DUMP_DIR=/ruta → guarda petición y respuesta completas del edge para auditarlas fuera.
      if (process.env.ACOMODO_DUMP_DIR) {
        fs.mkdirSync(process.env.ACOMODO_DUMP_DIR, { recursive: true });
        fs.writeFileSync(`${process.env.ACOMODO_DUMP_DIR}/${P.clave}.json`, JSON.stringify({ peticion: payload, respuesta: ultima, acomodo: cot.acomodo, partidas: ps }, null, 1));
      }
      console.log(`[${P.clave}] anclas al solver:`, JSON.stringify(payload.piezas.filter((x) => /^ANCHOR/.test(x.relation_role || '')).map((x) => [x.id, x.instance_id || null, x.user_capacity || null, x.placement_profile?.topology || x.placement_profile || null, x.functional_group_id || null])));
      console.log(`[${P.clave}] sillas colocadas por ancla:`, JSON.stringify(Object.entries(cot.acomodo.plan.colocacion.filter((c) => /w-1|s-1/.test(c.id)).reduce((m, c) => { m[c.anchor_instance_id || '∅'] = (m[c.anchor_instance_id || '∅'] || 0) + 1; return m; }, {}))));
      expect(payload.piezas.length).toBe(P.piezasEsperadas);
      expect(fails, 'cero invariantes duras (colisión/fuera/puerta)').toHaveLength(0);
      expect(colocadas).toBeGreaterThanOrEqual(P.minColocadas);
      // Dependientes colocados siempre con su ancla (nunca sueltos).
      for (const c of cot.acomodo.plan.colocacion) {
        const pz = payload.piezas.find((x) => x.id === c.id);
        if (pz && /_SEAT$/.test(pz.relation_role || '')) expect(c.anchor_instance_id, `${c.id} con ancla`).toBeTruthy();
      }
      if (colocadas < payload.piezas.length) await expect(page.getByTestId('diagnostico-acomodo')).toBeVisible();
      await expect(page.getByTestId('veredicto-acomodo')).toBeVisible();

      // 3) Nube real + reabrir desde el Archivo.
      await expect.poll(async () => (await leerCot(page))?.id || null, { timeout: 20000 }).not.toBeNull();
      const id = (await leerCot(page)).id;
      const firmaDe = (x) => JSON.stringify((x || []).map((p) => [p.id, p.cantidad, p.relation_role ?? null]).sort());
      const leerNube = () => page.evaluate(async ([origen, apikey, idc]) => {
        const k = Object.keys(window.localStorage).find((x) => /^sb-.*-auth-token$/.test(x));
        const tok = k ? (JSON.parse(window.localStorage.getItem(k) || '{}').access_token || null) : null;
        const r = await fetch(`${origen}/rest/v1/rpc/cotizacion_segura`, { method: 'POST', headers: { 'content-type': 'application/json', apikey, authorization: `Bearer ${tok}` }, body: JSON.stringify({ p_id: idc }) });
        const j = await r.json().catch(() => null);
        return { status: r.status, partidas: j?.partidas || null, colocadas: j?.acomodo?.plan?.colocacion?.length ?? null };
      }, [nubeOrigen, nubeApikey, id]);
      await expect.poll(async () => (await leerNube()).colocadas, { timeout: 30000 }).toBe(colocadas);
      expect(firmaDe((await leerNube()).partidas)).toBe(firmaDe(cot.partidas));
      await page.evaluate(([k, v]) => window.localStorage.setItem(k, JSON.stringify(v)), [CLAVE, { onboardingVisto: true, cotizacion: { partidas: [] } }]);
      await page.reload();
      await expect(page.getByRole('button', { name: /Salir/i })).toBeVisible({ timeout: 20000 });
      await page.getByText('Presupuestos anteriores', { exact: false }).first().click();
      const tarjeta = page.locator('.tarjeta:has(> .fila-botones)', { hasText: P.cliente }).first();
      await expect(tarjeta).toBeVisible({ timeout: 20000 });
      await tarjeta.getByRole('button', { name: /^Abrir$/ }).click();
      await expect.poll(async () => (await leerCot(page))?.partidas?.length || 0, { timeout: 20000 }).toBe(cot.partidas.length);
      const cot2 = await leerCot(page);
      expect(cot2.id).toBe(id);
      expect(firmaDe(cot2.partidas)).toBe(firmaDe(cot.partidas));
      expect(cot2.acomodo?.plan?.colocacion?.length ?? 0).toBe(colocadas);

      // 4) PDF preliminar (sin emitir).
      const descargar = page.getByRole('button', { name: /Descargar PDF/i }).first();
      await expect(descargar).toBeVisible({ timeout: 15000 });
      const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), descargar.click()]);
      console.log(`[${P.clave}] descarga: ${await dl.suggestedFilename()} · ${String(dl.url()).slice(0, 60)}`);
      expect((await dl.suggestedFilename()).toLowerCase()).toMatch(/\.pdf$/);
      console.log(`[${P.clave}] nube id ${id} · PDF ${await dl.suggestedFilename()}`);
      expect(pageErrors, pageErrors.join('\n')).toHaveLength(0);
    });
  }
});
