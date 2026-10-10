import { expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

// ============================================================================
//  HELPER COMÚN · CASO TORRE SUR por las TRES entradas de espacio (PDF / Dibujo / m²).
//  Cada spec sólo difiere en cómo entra el espacio; de "Muebles" en adelante el
//  contrato es el mismo y aquí se verifica IGUAL para las tres rutas:
//    armar → cotizar-texto (evidencia) → nada se pierde → anclas costeadas con
//    identidad → refresh sin pérdida → Acomodo real (solver llamado y coloca).
//  Evidencia por ruta: e2e/evidence/torre-sur-<ruta>-*.json (sin credenciales ni
//  texto del cliente más allá de lo que el formulario arma).
// ============================================================================
export const CLAVE = 'costeador-vonhaucke-v1';
export const EMAIL = process.env.TEST_EMAIL;
export const PASS = process.env.TEST_PASSWORD;
export const hayCreds = !!(EMAIL && PASS);

// Programa golden del plano ARQ-01 (metros): 8 puestos, 1 privado, 1 sala (8 asientos), recepción.
export const TORRE_SUR = {
  cuartos: [
    { nombre: 'OFICINA CEO', tipo: 'privado', ancho: 4, largo: 3.2 },
    { nombre: 'SALA DE CONSEJO', tipo: 'juntas', ancho: 7, largo: 3.2 },
    { nombre: 'ÁREA OPERATIVA', tipo: 'open', ancho: 8, largo: 3.2 },
    { nombre: 'RECEPCIÓN', tipo: 'recepcion', ancho: 4, largo: 2.4 },
  ],
  puestos: 8, privados: 1, juntasPax: 8, m2EntreEjes: 132,
};

export const leerCot = (page) => page.evaluate((clave) => {
  try { return JSON.parse(window.localStorage.getItem(clave))?.cotizacion || {}; } catch (_e) { return {}; }
}, CLAVE);

export const evidencia = (nombre, data) => {
  const f = path.resolve(process.cwd(), 'e2e/evidence', nombre);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify(data, null, 2));
};

export const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

export async function login(page) {
  await page.addInitScript((clave) => {
    try { if (!window.localStorage.getItem(clave)) window.localStorage.setItem(clave, JSON.stringify({ onboardingVisto: true })); } catch (_e) { /* privado */ }
  }, CLAVE);
  await page.goto('/');
  await page.fill('#email-login', EMAIL);
  await page.fill('#pass-login', PASS);
  await page.getByRole('button', { name: /^Entrar$/i }).click();
  await expect(page.getByRole('button', { name: /Salir/i })).toBeVisible({ timeout: 20000 });
}

/** Contador del formulario "Dime qué lleva" (Operativos / Privados / Sala de juntas…): lo lleva a `objetivo` con ± como una persona. */
export async function ajustarContador(page, etiqueta, objetivo) {
  const fila = page.locator('div', { has: page.locator('.prog-et strong', { hasText: new RegExp(`^${etiqueta}$`) }) }).last();
  const valor = async () => Number((await fila.locator('.valor').first().textContent()) || 0);
  for (let i = 0; i < 40; i++) {
    const v = await valor();
    if (v === objetivo) return;
    await fila.getByRole('button', { name: v > objetivo ? 'Menos' : 'Más' }).click();
  }
  expect(await valor(), `${etiqueta} no llegó a ${objetivo}`).toBe(objetivo);
}

/**
 * De "Muebles" en adelante. `opts.puestos` = puestos que DEBE pedir el texto (lector o persona).
 * Devuelve { items, banco, noEnc, partidas, cotJson }.
 */
export async function armarYVerificar(page, { ruta, puestos = null, warnsCotizar = [] }) {
  const pasoMuebles = page.getByTestId('voni-paso-muebles');
  if (await pasoMuebles.isEnabled().catch(() => false)) await pasoMuebles.click();
  await expect(page.getByRole('button', { name: /Armar el proyecto/i })).toBeVisible({ timeout: 30000 });
  if (puestos != null) await ajustarContador(page, 'Operativos', puestos);

  const cotResp = page.waitForResponse((r) => /cotizar-texto/.test(r.url()) && r.request().method() === 'POST', { timeout: 120000 });
  await page.getByRole('button', { name: /Armar el proyecto/i }).click();
  const cot = await cotResp;
  const cotJson = await cot.json().catch(() => null);
  const textoEnviado = (() => { try { return String(JSON.parse(cot.request().postData() || '{}').texto || ''); } catch (_e) { return ''; } })();
  expect(cotJson?.ok, `cotizar-texto ok=false: ${JSON.stringify(cotJson?.error || '')}`).toBe(true);
  const items = cotJson?.propuesta?.items || [];
  const banco = cotJson?.propuesta?.banco || [];
  const noEnc = cotJson?.propuesta?.noEncontrado || [];
  evidencia(`torre-sur-${ruta}-cotizar-texto.json`, {
    fecha: new Date().toISOString(), ruta,
    edge_rondasAclaracion: cotJson?.rondasAclaracion ?? null, sugerenciasDescartadas: cotJson?.sugerenciasDescartadas ?? null,
    items: items.map((it) => ({ ruta: it.ruta, producto: it.producto, cantidad: it.cantidad, seleccion: it.seleccion, etiqueta: it.etiqueta, material_override: it.material_override || null, sugerido: !!it.sugerido })),
    banco: banco.map((b) => ({ id: b.id, cantidad: b.cantidad, etiqueta: b.etiqueta, sugerido: !!b.sugerido })),
    noEncontrado: noEnc, preguntas: cotJson?.propuesta?.preguntas || [], warnsCotizar,
    textoEnviado: textoEnviado.slice(0, 1500),
  });

  // COT-P0-003: el texto pide los puestos acordados (contados o corregidos), no una estimación.
  if (puestos != null) {
    expect(textoEnviado, `texto enviado: "${textoEnviado.slice(0, 120)}…"`).toMatch(new RegExp(`^\\s*${puestos}\\s+lugares de trabajo`));
    expect(textoEnviado, 'gavetas ≠ puestos').toMatch(new RegExp(`${puestos}\\s+gavetas`));
  }

  // COT-P0-008: nada se pierde — cada item/banco/noEncontrado tiene partida (costeada o pendiente).
  await expect.poll(async () => ((await leerCot(page)).partidas || []).length, { timeout: 30000 }).toBeGreaterThan(0);
  const cotz = await leerCot(page);
  const partidas = cotz.partidas || [];
  const lote = partidas.filter((p) => p.loteIA);
  expect(lote.length, `items=${items.length} banco=${banco.length} noEnc=${noEnc.length} vs lote=${lote.length}`).toBeGreaterThanOrEqual(items.length + banco.length + noEnc.length);
  for (const p of lote) {
    if (p.precioUnitario == null) expect(p.requiere_costeo || p.price_status === 'SIN_PRECIO', `sin precio y sin marca: ${p.nombre}`).toBeTruthy();
    else expect(p.precioUnitario, `precio $0 en ${p.nombre}`).toBeGreaterThan(0);
    if (p.deBanco) expect(p.costoUnitario, `banco con costo 0 en ${p.nombre}`).not.toBe(0);
  }

  // COT-P0-009/004: anclas pedidas por la IA → costeadas, con identidad en Eclipse.
  const claveDe = (it) => { const r = String(it.ruta || ''); if (r.includes('/')) { const [a, ...b] = r.split('/'); return `${norm(a)}/${norm(b.join('/'))}`; } return `${norm(r)}/${norm(it.producto)}`; };
  const pedido = (r, p) => items.some((it) => claveDe(it) === `${norm(r)}/${norm(p)}` || (norm(it.ruta) === norm(r) && norm(it.etiqueta).includes(norm(p).slice(0, 5))));
  const costeada = (r, p) => lote.find((x) => x.ruta === r && x.productoId === p && x.precioUnitario > 0);
  const pendiente = (r) => lote.find((x) => x.requiere_costeo && norm(x.ruta).startsWith(norm(r)));
  for (const [r, p] of [['applt', 'banca_doble'], ['eclipse', 'escritorio'], ['eclipse', 'credenza'], ['applt', 'mesa_juntas'], ['mox', 'pedestal']]) {
    if (!pedido(r, p)) continue;
    const c = costeada(r, p);
    expect(c, `${r}/${p} pedido pero NO costeado → ${pendiente(r)?.motivoPendiente || 'desconocido'}`).toBeTruthy();
    if (r === 'eclipse') expect(c.producto_id, `${r}/${p} sin identidad Producto Maestro`).toBeTruthy();
  }
  // Golden: 8 WIN · 8 gavetas · 1 ALPHA · 2 CONCERTO (lo que depende del lector/forma se reporta, no se exige aquí)
  const cant = (re) => lote.filter((x) => re.test(norm(x.nombre))).reduce((s, x) => s + (x.cantidad || 0), 0);
  if (puestos != null) {
    expect(cant(/win/), 'WIN').toBe(puestos);
    expect(cant(/gaveta|pedestal/), 'gavetas').toBe(puestos);
  }
  expect(cant(/alpha/), 'ALPHA').toBe(1);
  expect(cant(/concerto/), 'CONCERTO').toBe(2);

  // COT-P0-038: brief persistido y refresh sin pérdida.
  expect(cotz.programaBrief, 'programaBrief no persistido').toBeTruthy();
  await page.reload();
  await expect(page.getByRole('button', { name: /Salir/i })).toBeVisible({ timeout: 20000 });
  expect(((await leerCot(page)).partidas || []).length).toBe(partidas.length);
  return { items, banco, noEnc, partidas, cotJson };
}

/** Paso 3 real: programa no bloqueado, solver llamado, coloca, plan persistido. `estadoFS` = estado del FloorSpec (null en dibujo/m²). */
export async function verificarAcomodo(page, { ruta, estadoFS = null }) {
  await page.getByTestId('home-cotizar').click().catch(() => {});
  const acomodoResp = page.waitForResponse((r) => /acomodar-espacio/.test(r.url()) && r.request().method() === 'POST', { timeout: 150000 });
  const pasoAcomodo = page.getByTestId('voni-paso-acomodo');
  if (!(await pasoAcomodo.isEnabled())) await page.getByTestId('voni-paso-muebles').click();
  await expect(pasoAcomodo, 'paso Acomodo deshabilitado con espacio + partidas').toBeEnabled({ timeout: 15000 });
  await pasoAcomodo.click();
  const btnAcomodar = page.getByRole('button', { name: /^Acomodar$/ });
  await expect(btnAcomodar).toBeVisible({ timeout: 30000 });
  const bloqueado = await page.getByText(/No voy a acomodar un programa comercial incompleto|Todavía no:/).first().isVisible().catch(() => false);
  expect(bloqueado, 'Acomodo bloqueado por programa incompleto').toBe(false);
  if (await btnAcomodar.isEnabled()) await btnAcomodar.click().catch(() => {});
  const aco = await acomodoResp.catch(() => null);
  if (!aco) {
    const msg = await page.getByText(/No voy a acomodar|no permite acomodar|No acomodo/).first().textContent().catch(() => null);
    expect(aco, `el solver nunca fue llamado. Mensaje: ${msg || '(ninguno)'}`).toBeTruthy();
  }
  const acoJson = await aco.json().catch(() => null);
  let reqBody = null; try { reqBody = JSON.parse(aco.request().postData() || '{}'); } catch (_e) { /* sin body */ }
  const colocacion = acoJson?.plan?.colocacion || [];
  const porArea = {}; for (const c of colocacion) porArea[c.area ?? '?'] = (porArea[c.area ?? '?'] || 0) + 1;
  evidencia(`torre-sur-${ruta}-acomodo.json`, {
    fecha: new Date().toISOString(), ruta, http: aco.status(), ok: acoJson?.ok ?? null, status: acoJson?.status ?? null,
    metodo: acoJson?.metodo ?? null, attempts_used: acoJson?.attempts_used ?? null, render_ready: acoJson?.render_ready ?? null,
    piezasEnviadas: reqBody?.piezas?.length ?? null, sinRol: (reqBody?.piezas || []).filter((p) => !p.relation_role).length,
    colocadas: colocacion.length, porArea, no_cupieron: acoJson?.layoutSpec?.no_cupieron ?? null, unassigned: acoJson?.layoutSpec?.unassigned ?? null,
    mensaje_vendedor: acoJson?.mensaje_vendedor ?? acoJson?.layoutSpec?.mensaje_vendedor ?? null,
  });
  evidencia(`torre-sur-${ruta}-acomodo-full.json`, { fecha: new Date().toISOString(), request: { areas: reqBody?.areas, piezas: reqBody?.piezas }, response: acoJson });
  expect(aco.status(), 'acomodar-espacio HTTP').toBe(200);
  expect(acoJson?.ok, `solver ok=false: ${JSON.stringify(acoJson?.error || acoJson?.status || '')}`).toBe(true);
  expect(reqBody?.piezas?.length, 'el solver no recibió piezas').toBeGreaterThan(0);
  // COT-P0-025: ninguna pieza viaja sin rol funcional
  expect((reqBody?.piezas || []).filter((p) => !p.relation_role).length, 'piezas sin relation_role').toBe(0);
  expect(colocacion.length, `el solver no colocó nada (status ${acoJson?.status})`).toBeGreaterThan(0);
  // COT-P0-041b: el juez duro del solver NO puede reportar issues (OVERLAP/puerta/obstáculo)
  // en un acomodo que se presenta como colocado. Antes esto pasaba en silencio.
  const duros = (acoJson?.layoutSpec?.validation?.issues || []).filter((i) => i.severity === 'fail');
  expect(duros, `issues duros del solver: ${JSON.stringify(duros)}`).toEqual([]);
  // Guardado de apoyo (credenza/archivero) viaja como ancla propia, nunca como "gaveta" del escritorio.
  expect((reqBody?.piezas || []).filter((p) => p.relation_role === 'SUPPORT_STORAGE').length, 'SUPPORT_STORAGE suelto en el payload (bundle viejo o regresión)').toBe(0);
  // Cada cuarto con rol (privado/juntas/recepción) recibe al menos su ancla: nada "todo al open".
  const areasReq = reqBody?.areas || [];
  const tipoDeArea = (i) => String(areasReq[i]?.tipo || '').toLowerCase();
  const porTipo = {}; for (const c of colocacion) { const t = tipoDeArea(c.area); porTipo[t] = (porTipo[t] || 0) + 1; }
  for (const t of ['privado', 'juntas', 'recepcion']) {
    if (areasReq.some((a) => String(a.tipo || '').toLowerCase() === t)) expect(porTipo[t] || 0, `cuarto "${t}" sin muebles: ${JSON.stringify(porTipo)}`).toBeGreaterThan(0);
  }
  // Las 4 anclas colocadas (bench, escritorio privado, mesa, recepción)
  const anclas = (reqBody?.piezas || []).filter((p) => String(p.relation_role || '').startsWith('ANCHOR_'));
  const idsColocados = new Set(colocacion.map((c) => String(c.id)));
  const anclasColocadas = anclas.filter((a) => idsColocados.has(String(a.id)));
  expect(anclasColocadas.length, `anclas colocadas ${anclasColocadas.length}/${anclas.length}: faltan ${anclas.filter((a) => !idsColocados.has(String(a.id))).map((a) => a.relation_role).join(',')}`).toBe(anclas.length);
  // PDF 15:01Z: el bench se colocó en variante MÍNIMA (ancla sin sus 8 WIN) y esto "pasaba".
  // Un acomodo con piezas sin colocar NO es un acomodo: nada queda fuera (fail-closed).
  const sinColocar = (reqBody?.piezas || []).filter((p) => !idsColocados.has(String(p.id)));
  expect(sinColocar.length, `piezas SIN colocar (${sinColocar.length}/${reqBody?.piezas?.length}): ${sinColocar.map((p) => `${p.relation_role}:${p.nombre || p.id}`).slice(0, 6).join(' | ')} · no_cupieron=${JSON.stringify((acoJson?.layoutSpec?.no_cupieron || []).map((u) => ({ ancla: u.anchorId, inv: u.invariante, causa: u.certificado?.primary_cause })))}`).toBe(0);
  await expect.poll(async () => ((await leerCot(page)).acomodo?.plan?.colocacion || []).length, { timeout: 30000 }).toBeGreaterThan(0);
  // COT-P0-022: con plano en revisión sólo borrador; sin FloorSpec (dibujo/m²) debe poder guardarse en la propuesta.
  if (estadoFS && String(estadoFS).toUpperCase() !== 'PASS') {
    await expect(page.getByRole('button', { name: /Guardar borrador de acomodo/ }), `plano ${estadoFS}: sólo borrador`).toBeVisible({ timeout: 60000 });
  }
  return { acoJson, reqBody, colocacion };
}
