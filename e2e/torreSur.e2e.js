import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

// ============================================================================
//  E2E REAL · CASO TORRE SUR (plano ARQ-01, 104 m², Rodrigo 2026-10-10)
//  Recorrido autenticado: Home → Cotizar (Voni) → subir el PDF real → formulario
//  "Dime qué lleva" → Armar el proyecto → evidencia de cotizar-texto → partidas.
//
//  Este spec CAPTURA EVIDENCIA además de verificar: el payload de la IA (sólo
//  ruta/producto/seleccion/etiqueta — sin texto del cliente) se guarda en
//  e2e/evidence/torre-sur-cotizar-texto.json para fijar la causa EXACTA de cada
//  "No pude costear". Requiere TEST_EMAIL / TEST_PASSWORD (Claude no puede
//  ejecutarlo: no ingresa credenciales contra un backend remoto).
//
//  Verifica (punto 4 del mandato): NINGÚN item de la IA desaparece — cada item
//  entra como partida costeada o como partida PENDIENTE (precio null, nunca $0).
// ============================================================================
const EMAIL = process.env.TEST_EMAIL;
const PASS = process.env.TEST_PASSWORD;
const hayCreds = !!(EMAIL && PASS);
const CLAVE = 'costeador-vonhaucke-v1';
const PDF = path.resolve(process.cwd(), 'e2e/fixtures/plano-torre-sur-arq01.pdf');
const EVIDENCIA = path.resolve(process.cwd(), 'e2e/evidence/torre-sur-cotizar-texto.json');

const leerCot = (page) => page.evaluate((clave) => {
  try { return JSON.parse(window.localStorage.getItem(clave))?.cotizacion || {}; } catch (_e) { return {}; }
}, CLAVE);

test.describe('E2E TORRE SUR · plano real → cotización sin pérdidas', () => {
  test.skip(!hayCreds, 'Define TEST_EMAIL y TEST_PASSWORD para correr el recorrido real.');
  test.setTimeout(240000);

  test('PDF real → Voni arma el proyecto; cada item de la IA sobrevive (costeado o pendiente)', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e?.message || e)));
    const warnsCotizar = [];
    page.on('console', (m) => { if (m.type() === 'warning' && /\[Cotizar\]|costearItem/.test(m.text())) warnsCotizar.push(m.text()); });

    // Estado limpio y sin guía.
    await page.addInitScript((clave) => {
      try { if (!window.localStorage.getItem(clave)) window.localStorage.setItem(clave, JSON.stringify({ onboardingVisto: true })); } catch (_e) { /* privado */ }
    }, CLAVE);

    await page.goto('/');
    await page.fill('#email-login', EMAIL);
    await page.fill('#pass-login', PASS);
    await page.getByRole('button', { name: /^Entrar$/i }).click();
    await expect(page.getByRole('button', { name: /Salir/i })).toBeVisible({ timeout: 20000 });

    await page.getByTestId('home-cotizar').click();

    // 1) LECTURA DEL PLANO: subir el PDF real por el input oculto de Voni.
    const lecturaResp = page.waitForResponse((r) => /leer-plano/.test(r.url()) && r.request().method() === 'POST', { timeout: 120000 });
    await page.getByTestId('cotizar-plano').setInputFiles(PDF);
    const lectura = await lecturaResp;
    expect(lectura.status(), 'leer-plano debe responder 200').toBe(200);
    const lecturaJson = await lectura.json().catch(() => null);
    expect(lecturaJson?.ok, `leer-plano ok=false: ${JSON.stringify(lecturaJson?.error || '')}`).toBe(true);
    // Evidencia del LECTOR (bloque 3: ¿de dónde salen 10 puestos / sala de 6 si el plano
    // tiene 8 y 10?): áreas con puestos, observed_program y validación. Sin imagen.
    const EVIDENCIA_LECTURA = path.resolve(process.cwd(), 'e2e/evidence/torre-sur-leer-plano.json');
    fs.mkdirSync(path.dirname(EVIDENCIA_LECTURA), { recursive: true });
    fs.writeFileSync(EVIDENCIA_LECTURA, JSON.stringify({
      fecha: new Date().toISOString(),
      request_id: lecturaJson?.request_id ?? null,
      envolvente: lecturaJson?.lectura?.envolvente ?? null,
      areas: (lecturaJson?.lectura?.areas || []).map((a) => ({ nombre: a.nombre, tipo: a.tipo, puestos: a.puestos ?? null, confianza: a.confianza ?? null, dentroDe: a.dentroDe ?? null, puntos: (a.puntos || []).length })),
      puertas: (lecturaJson?.lectura?.puertas || []).length,
      observed_validation: lecturaJson?.floorSpec?.observed_validation ?? null,
      observed_program: (lecturaJson?.floorSpec?.observed_program || lecturaJson?.observed_program || []).map((o) => ({ source_ref: o.source_ref, type: o.type, role: o.role, zone: o.zone, quantity: o.quantity, capacity_per_unit: o.capacity_per_unit, capacity_total: o.capacity_total, dimensions: o.dimensions, confidence: o.confidence, origin: o.origin, review_required: o.review_required, issues: o.issues })),
      notas: lecturaJson?.lectura?.notas ?? [],
    }, null, 2));
    // Lo que el FORMULARIO de Voni va a mandar como texto (es la entrada real de cotizar-texto).
    const textoFormulario = await page.locator('textarea').first().inputValue().catch(() => null);

    // 2) MUEBLES: el formulario "Dime qué lleva" ya viene prellenado del plano.
    await page.getByText(/^Muebles$/).first().click();
    await expect(page.getByRole('button', { name: /Armar el proyecto/i })).toBeVisible({ timeout: 30000 });

    // 3) ARMAR → evidencia del contrato real de cotizar-texto.
    const cotResp = page.waitForResponse((r) => /cotizar-texto/.test(r.url()) && r.request().method() === 'POST', { timeout: 120000 });
    await page.getByRole('button', { name: /Armar el proyecto/i }).click();
    const cot = await cotResp;
    const cotJson = await cot.json().catch(() => null);
    expect(cotJson?.ok, `cotizar-texto ok=false: ${JSON.stringify(cotJson?.error || '')}`).toBe(true);
    const items = cotJson?.propuesta?.items || [];
    const banco = cotJson?.propuesta?.banco || [];
    const noEnc = cotJson?.propuesta?.noEncontrado || [];
    fs.mkdirSync(path.dirname(EVIDENCIA), { recursive: true });
    fs.writeFileSync(EVIDENCIA, JSON.stringify({
      fecha: new Date().toISOString(),
      edge_rondasAclaracion: cotJson?.rondasAclaracion ?? null,
      sugerenciasDescartadas: cotJson?.sugerenciasDescartadas ?? null,
      items: items.map((it) => ({ ruta: it.ruta, producto: it.producto, cantidad: it.cantidad, seleccion: it.seleccion, etiqueta: it.etiqueta, material_override: it.material_override || null, sugerido: !!it.sugerido })),
      banco: banco.map((b) => ({ id: b.id, cantidad: b.cantidad, etiqueta: b.etiqueta, sugerido: !!b.sugerido })),
      noEncontrado: noEnc,
      preguntas: cotJson?.propuesta?.preguntas || [],
      warnsCotizar,
      // El texto que armó el formulario (prellenado desde el plano): es la verdad de
      // entrada para juzgar si "10 usuarios" lo puso el formulario o la IA.
      textoFormulario: textoFormulario ? String(textoFormulario).slice(0, 1500) : null,
      textoEnviado: (() => { try { return String(JSON.parse(cot.request().postData() || '{}').texto || '').slice(0, 1500); } catch (_e) { return null; } })(),
    }, null, 2));

    // 3-bis) COT-P0-003: si el lector CONTÓ puestos en el área operativa, el texto que el
    //    formulario mandó a la IA debe pedir ESE número (no la estimación por m²).
    const opLector = (lecturaJson?.lectura?.areas || []).filter((a) => a.tipo === 'open' && Number(a.puestos) > 0)
      .reduce((s, a) => s + Number(a.puestos), 0);
    const textoEnviado = (() => { try { return String(JSON.parse(cot.request().postData() || '{}').texto || ''); } catch (_e) { return ''; } })();
    if (opLector > 0) {
      expect(textoEnviado, `el lector contó ${opLector} puestos pero el formulario mandó: "${textoEnviado.slice(0, 120)}…"`).toMatch(new RegExp(`^\\s*${opLector}\\s+lugares de trabajo`));
      expect(textoEnviado, 'gavetas ≠ puestos contados').toMatch(new RegExp(`${opLector}\\s+gavetas`));
    }

    // 4) NADA SE PIERDE: cada item/banco/noEncontrado tiene partida (costeada o pendiente).
    await expect.poll(async () => ((await leerCot(page)).partidas || []).length, { timeout: 30000 }).toBeGreaterThan(0);
    const cotz = await leerCot(page);
    const partidas = cotz.partidas || [];
    const lote = partidas.filter((p) => p.loteIA);
    const esperados = items.length + banco.length + noEnc.length;
    expect(lote.length, `items IA=${items.length} banco=${banco.length} noEnc=${noEnc.length} vs partidas del lote=${lote.length}`).toBeGreaterThanOrEqual(esperados);
    for (const p of lote) {
      // DESCONOCIDO ≠ $0: una partida sin precio es pendiente explícita, nunca 0.
      if (p.precioUnitario == null) expect(p.requiere_costeo || p.price_status === 'SIN_PRECIO', `partida sin precio y sin marca: ${p.nombre}`).toBeTruthy();
      else expect(p.precioUnitario, `precio $0 en ${p.nombre}`).toBeGreaterThan(0);
      if (p.deBanco) expect(p.costoUnitario, `banco con costo 0 en ${p.nombre}`).not.toBe(0);
    }

    // 5) ANCLAS DEL PLANO (lo que Rodrigo vio en "No pude costear"): si la IA pidió
    //    applt/banca_doble, eclipse/escritorio, eclipse/credenza, applt/mesa_juntas,
    //    deben estar COSTEADAS (con identidad), no pendientes.
    //    La edge v10 fusiona "linea/producto" en `ruta` (evidencia 2026-10-10): se normaliza
    //    igual que resolverRutaProducto para que el assert NO se salte el ancla.
    const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const claveDe = (it) => {
      const r = String(it.ruta || '');
      if (r.includes('/')) { const [a, ...b] = r.split('/'); return `${norm(a)}/${norm(b.join('/'))}`; }
      return `${norm(r)}/${norm(it.producto)}`;
    };
    const pedido = (ruta, producto) => items.some((it) => claveDe(it) === `${norm(ruta)}/${norm(producto)}` || (norm(it.ruta) === norm(ruta) && norm(it.etiqueta).includes(norm(producto).slice(0, 5))));
    const costeada = (ruta, producto) => lote.find((p) => p.ruta === ruta && p.productoId === producto && p.precioUnitario > 0);
    const pendiente = (ruta, producto) => lote.find((p) => p.requiere_costeo && (norm(p.ruta).startsWith(norm(ruta))));
    for (const [ruta, producto] of [['applt', 'banca_doble'], ['eclipse', 'escritorio'], ['eclipse', 'credenza'], ['applt', 'mesa_juntas'], ['mox', 'pedestal']]) {
      if (!pedido(ruta, producto)) continue;
      const c = costeada(ruta, producto);
      expect(c, `${ruta}/${producto} pedido por la IA pero NO costeado → quedó como ${pendiente(ruta, producto)?.motivoPendiente || 'desconocido'} (ver evidencia JSON)`).toBeTruthy();
      if (ruta === 'eclipse') expect(c.producto_id, `${ruta}/${producto} sin identidad Producto Maestro`).toBeTruthy();
    }

    // 6) BRIEF persistido (identidad de lo pedido) y refresh sin pérdida.
    expect(cotz.programaBrief, 'programaBrief no persistido').toBeTruthy();
    await page.reload();
    await expect(page.getByRole('button', { name: /Salir/i })).toBeVisible({ timeout: 20000 });
    const tras = await leerCot(page);
    expect((tras.partidas || []).length).toBe(partidas.length);

    expect(pageErrors, pageErrors.join('\n')).toHaveLength(0);
  });
});
