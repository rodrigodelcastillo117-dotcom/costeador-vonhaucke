// ============================================================================
//  COCREAR 10 · flujo completo de principio a fin en navegador real (Chromium) con la NUBE FALSA.
//  docs/auditoria/COCREAR_10.md.
//
//  Además de nubeFalsa.js, aquí se simulan las RPC de co-creación y el modo cocrear de
//  costear-servidor con la semántica de la PROPUESTA (supabase/migrations/PROPUESTA_cocrear_costo_servidor.sql,
//  probada contra PostgreSQL real en supabase/tests/cocrearCostoServidor.test.js). El costeo del
//  "servidor" corre los MISMOS módulos que la Edge (cocrearServidor.js, validarIntentCosteo, calcular,
//  revisarEstructura) con los insumos semilla. Nada toca producción ni llama IA real.
//
//  Cubre: D-01 (concepto → BOM de línea escalado; mueble nuevo → Costear → regreso con BOM),
//  D-02 (el precio de la partida es el del servidor; el payload no lleva importes), D-03 (validar
//  ingeniería la decide el servidor), D-06 (render y referencia sobreviven a reabrir), N-04 (subir
//  imagen) y seller-safe (el vendedor nunca ve costo).
// ============================================================================
import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { crearNubeFalsa, HOST, sinEconomia } from './nubeFalsa.js';
import {
  validarSolicitudCocrear, accesoACocreacion, piezaDeCocreacion, decidirValidacionIngenieria,
  filaCostoCocreacion, respuestaCocreacionPorRol, precioSugeridoCocreado,
} from '../src/datos/cocrearServidor.js';
import { validarIntentCosteo } from '../src/datos/validarIntentCosteo.js';
import { calcular, costeoEmitible, PARAMETROS_DEFAULT } from '../src/motor/calculo.js';
import { revisarEstructura } from '../src/datos/revisionEstructural.js';
import { INSUMOS_SEMILLA, mapaInsumos } from '../src/datos/insumos.js';

const USUARIOS = { 'ventas@vh.mx': 'vendedor', 'rodrigo@vh.mx': 'direccion', 'diseno@vh.mx': 'diseno' };
const PASS = 'prueba-123';
const insumos = mapaInsumos(INSUMOS_SEMILLA);
const par = { ...PARAMETROS_DEFAULT };
// PNG 1×1 válido (imagen de referencia del cliente).
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

function emailDe(req) {
  const m = /^Bearer (.+)$/.exec(req.headers()['authorization'] || ''); if (!m) return null;
  try { return JSON.parse(Buffer.from(m[1].split('.')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()).email || null; } catch { return null; }
}

// Expedientes de co-creación + tabla cocrear_costeo_servidor + Storage, con la semántica de la propuesta.
function servidorCocrear(rolDe) {
  const exps = new Map(); const filas = []; const subidas = []; const registros = []; let sig = 500;
  const md5 = (o) => createHash('md5').update(JSON.stringify(o)).digest('hex');
  const filaVigente = (e) => filas.filter((f) => f.expediente_id === e.id && f.analysis_hash === e.analysis_hash)
    .sort((a, b) => (b.ingenieria_validada - a.ingenieria_validada) || (b._n - a._n))[0] || null;
  const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

  async function manejar(route) {
    const req = route.request(); const url = new URL(req.url());
    const ruta = url.pathname.replace(/^(\/functions\/v1\/[a-z-]+?)-rc$/, '$1');
    const email = emailDe(req); const rol = email ? rolDe(email) : null;
    const body = (() => { try { return req.postDataJSON?.() || {}; } catch { return {}; } })();
    if (ruta === '/rest/v1/rpc/guardar_cocrear_seguro') {
      const p = body.p_payload; const h = md5(p);
      if (body.p_expediente_id == null) {
        const id = sig++; exps.set(id, { id, creado_por: email, revision: 1, analysis_hash: h, cocrear: p, nombre: p.nombre, producto_tipo: p.familia, actualizado: new Date().toISOString() });
        return json(route, { ok: true, expediente_id: id, revision: 1, nueva_revision: true, analysis_hash: h });
      }
      const e = exps.get(Number(body.p_expediente_id));
      if (!e) return json(route, { message: 'expediente no existe' }, 400);
      if (e.analysis_hash === h) return json(route, { ok: true, expediente_id: e.id, revision: e.revision, nueva_revision: false, idempotente: true });
      Object.assign(e, { revision: e.revision + 1, analysis_hash: h, cocrear: p, nombre: p.nombre, actualizado: new Date().toISOString() });
      return json(route, { ok: true, expediente_id: e.id, revision: e.revision, nueva_revision: true, analysis_hash: h });
    }
    if (ruta === '/rest/v1/rpc/cocrear_seguro') {
      const e = exps.get(Number(body.p_expediente_id));
      if (!e) return json(route, { ok: false, motivo: 'no_existe' });
      const f = filaVigente(e);
      const out = { ok: true, id: e.id, nombre: e.nombre, revision: e.revision, cocrear: e.cocrear, historia: [], render_aislado_url: null, validacion_servidor: f ? (({ _n, warnings, ...x }) => x)(f) : null };
      return json(route, rol === 'direccion' ? out : sinEconomia(out));
    }
    if (ruta === '/rest/v1/rpc/registrar_producto_desde_expediente') {
      const e = exps.get(Number(body.p_expediente_id)); const f = e && filaVigente(e);
      if (!f) return json(route, { ok: false, motivo: 'costo_servidor_pendiente' });
      if (f.costo_unitario == null) return json(route, { ok: false, motivo: 'expediente_incompleto_no_publicable' });
      const r = { ok: true, producto_id: 900 + e.id, version_id: 9000 + e.revision, estado_tecnico: f.ingenieria_validada ? 'aprobado' : 'preliminar', costo_fuente: 'costear-servidor' };
      registros.push({ ...r, costo: f.costo_unitario }); return json(route, r);
    }
    if (ruta === '/rest/v1/rpc/registrar_render_canonico') return json(route, { ok: true, id: 1 });
    if (ruta === '/rest/v1/expedientes' && req.method() === 'GET') {
      return json(route, [...exps.values()].map((e) => ({ id: e.id, nombre: e.nombre, producto_tipo: e.producto_tipo, estado: 'borrador', actualizado: e.actualizado, creado: e.actualizado })));
    }
    if (ruta.startsWith('/storage/v1/object/renders/') && req.method() === 'POST') {
      subidas.push(ruta); return json(route, { Key: ruta.slice('/storage/v1/object/'.length) });
    }
    if (ruta === '/functions/v1/costear-servidor' && body?.accion === 'cocrear') {
      // Orquestación de la Edge costear-servidor-rc (modo cocrear), con sus mismos módulos.
      const sol = validarSolicitudCocrear(body);
      if (!sol.ok) return json(route, { ok: false, code: sol.code, issues: sol.issues }, 400);
      const e = exps.get(sol.solicitud.expedienteId);
      if (!e) return json(route, { ok: false, code: 'NO_EXISTE' }, 404);
      if (!accesoACocreacion({ rol, email, creadoPor: e.creado_por })) return json(route, { ok: false, code: 'SIN_ACCESO' }, 403);
      const pz = piezaDeCocreacion(e.cocrear);
      if (!pz.ok) return json(route, { ok: false, code: pz.code, error: pz.motivo }, 409);
      const v = validarIntentCosteo({ cantidad: 1, pieza: pz.pieza });
      if (!v.ok) return json(route, { ok: false, code: 'BOM_INVALIDO', issues: v.issues }, 422);
      const r = calcular(v.intent.pieza, 1, insumos, par); const emision = costeoEmitible(r);
      const estado = emision.emitible ? 'preliminar' : 'incompleto';
      const bloqueos = (revisarEstructura({ componentes: pz.pieza.componentes, descripcion: e.cocrear?.brief || '', insumos }).observaciones || []).filter((o) => o.nivel === 'blocker').map((o) => o.mensaje);
      const decision = decidirValidacionIngenieria({ solicitada: sol.solicitud.validarIngenieria, rol, emitible: emision.emitible, estado, visualHashCliente: sol.solicitud.visualHash, visualHashServidor: pz.visualHash, bloqueosEstructura: bloqueos });
      const precio = precioSugeridoCocreado(estado !== 'incompleto' ? r.costoUnitario : null, { par });
      const fila = filaCostoCocreacion({ expediente: e, email, rol, pz, precio, decision: { ...decision, bloqueos }, costeo: { emitible: emision.emitible, estado, costoUnitario: r.costoUnitario, warnings: [], pendientes: emision.pendientes || [], versionMotor: 'e2e', versionCatalogo: 'config-fallback-e2e', fuenteCosto: 'config-fallback' } });
      filas.push({ ...fila, _n: filas.length });
      return json(route, respuestaCocreacionPorRol(rol, fila, { costeo: r, decision }));
    }
    return route.fallback();
  }
  return { exps, filas, subidas, registros, instalar: (context) => context.route(`${HOST}/**`, manejar) };
}

async function escenario(browser) {
  const nube = crearNubeFalsa({ usuarios: USUARIOS });
  const srv = servidorCocrear((e) => nube.permitidos.get(e) || null);
  const context = await browser.newContext();
  await nube.instalar(context);
  await srv.instalar(context);   // se registra DESPUÉS: atiende primero y cede lo demás a la nube falsa
  await context.addInitScript(() => { try { const k = 'costeador-vonhaucke-v1'; const s = JSON.parse(localStorage.getItem(k) || '{}'); s.onboardingVisto = true; localStorage.setItem(k, JSON.stringify(s)); } catch (_e) {} });
  const page = await context.newPage();
  const errores = [];
  page.on('pageerror', (e) => errores.push(String(e)));
  return { nube, srv, context, page, errores };
}
async function entrar(page, email) {
  await page.goto('/');
  await page.fill('#email-login', email);
  await page.fill('#pass-login', PASS);
  await page.getByRole('button', { name: /^Entrar$/i }).click();
  await expect(page.getByRole('button', { name: /Salir/i }).first()).toBeVisible({ timeout: 45000 });
  if (await page.getByRole('dialog', { name: /Guía de uso/i }).isVisible().catch(() => false)) await page.keyboard.press('Escape');
}
async function conceptoA(page, brief) {
  await page.getByTestId('home-cocrear').click();
  await page.locator('textarea.c3-input').first().fill(brief);
  await page.getByRole('button', { name: /Crear conceptos con VONI/ }).click();
  await page.getByRole('button', { name: /Desarrollar/ }).first().click();
  await expect(page.getByText('Bajar a BOM · costeo real')).toBeVisible({ timeout: 15000 });
}
async function bajarMesaAppLT(page) {
  await page.getByTestId('cocrear-linea').selectOption('applt');
  await page.getByTestId('cocrear-producto-linea').selectOption('mesa_juntas');
  await page.getByRole('button', { name: /Partir de este mueble/ }).click();
  await expect(page.getByTestId('cocrear-bom')).toContainText('Escalado de Mesa de juntas APP LT');
}
const money = /\$\s?[\d,]+\.\d{2}/;
// Capturas opcionales para revisar la pantalla (COCREAR10_CAPTURAS=<carpeta>); no afectan la prueba.
const captura = async (page, nombre) => { if (process.env.COCREAR10_CAPTURAS) await page.screenshot({ path: `${process.env.COCREAR10_CAPTURAS}/${nombre}.png`, fullPage: true }); };

test.describe('Cocrear 10 · de la idea al precio, con el servidor como dueño del dinero', () => {
  test('Diseño: concepto → BOM de línea escalado → validar en servidor → partida con precio del servidor → reabrir (render y referencia)', async ({ browser }) => {
    test.setTimeout(120_000);
    const { srv, context, page, errores } = await escenario(browser);
    await entrar(page, 'diseno@vh.mx');
    await page.getByTestId('home-cocrear').click();
    // N-04: imagen de referencia en el inicio.
    await page.getByTestId('cocrear-referencia').setInputFiles({ name: 'cliente.png', mimeType: 'image/png', buffer: PNG });
    await expect(page.getByTestId('cocrear-referencia-preview')).toBeVisible();
    await page.locator('textarea.c3-input').first().fill('Mesa de juntas de 1.35 m por 1.20 m de fondo, melamina');
    await page.getByRole('button', { name: /Crear conceptos con VONI/ }).click();
    await page.getByRole('button', { name: /Desarrollar/ }).first().click();
    await expect(page.getByText('Bajar a BOM · costeo real')).toBeVisible({ timeout: 15000 });

    // D-01: baja a BOM desde el mueble de línea y el motor lo costea (vista previa local para Diseño).
    await bajarMesaAppLT(page);
    await expect(page.getByText(/Costo calculado \(local, vista previa\)/)).toContainText(money);
    await expect(page.getByTestId('cocrear-estado-servidor')).toHaveText('sin costear');

    // D-06: render de ESTA revisión (la nube falsa responde con URL de Storage).
    await page.getByRole('button', { name: /^(Generar render|Regenerar)$/ }).first().click();
    await expect(page.locator('.c3-hero img')).toHaveAttribute('src', /^https:\/\//, { timeout: 15000 });

    // D-03: validar ingeniería → la decide el servidor.
    await page.getByRole('button', { name: 'Validar ingeniería de esta revisión' }).click();
    await expect(page.getByText('VALIDADA', { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('cocrear-estado-servidor')).toHaveText('preliminar');
    await expect(page.getByTestId('cocrear-precio')).toHaveText(money);
    // El precio de lista del mueble de catálogo del que parte no se toca; si el especial queda por debajo, se avisa.
    await expect(page.getByText(/Precio de lista de Mesa de juntas APP LT 1\.20 × 1\.20/)).toContainText(/queda por DEBAJO/);
    await captura(page, '1-diseno-validada');
    expect(srv.filas.at(-1).ingenieria_validada).toBe(true);
    expect(srv.filas.at(-1).validada_por).toBe('diseno@vh.mx');

    // Lo que se guardó: sin importes del navegador; render y referencia como URL pública.
    const exp = [...srv.exps.values()].at(-1);
    expect(exp.cocrear.costSnapshot).toEqual({ status: 'KNOWN', fuente: 'navegador_no_autoritativo' });
    expect(exp.cocrear.render?.url).toMatch(/^https:\/\//);
    expect(exp.cocrear.referencia?.url).toMatch(/^https:\/\/.*\/renders\/cocrear\//);
    expect(JSON.stringify(exp.cocrear)).not.toContain('base64');

    // D-02: la partida entra con el precio del SERVIDOR.
    const precioSrv = srv.filas.at(-1).precio_sugerido;
    await page.getByRole('button', { name: 'Convertir en partida' }).click();
    await expect(page.getByText(/Revisión canónica agregada a cotización/)).toBeVisible({ timeout: 15000 });
    expect(srv.registros.at(-1).estado_tecnico).toBe('aprobado');
    const partidas = await page.evaluate(() => JSON.parse(localStorage.getItem('costeador-vonhaucke-v1') || '{}').cotizacion?.partidas || []);
    const p = partidas.at(-1);
    expect(p.precioUnitario).toBeCloseTo(precioSrv, 2);
    expect(p.producto_version_id).toBeTruthy();

    // Reabrir: vuelve todo (render vigente, referencia, verdad del servidor).
    await page.getByRole('button', { name: '‹ Nueva idea' }).click();
    await page.getByRole('button', { name: /reabrir/ }).first().click();
    await expect(page.getByText('Bajar a BOM · costeo real')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.c3-hero img')).toHaveAttribute('src', /^https:\/\//);
    await expect(page.getByText(/Este render está vencido/)).toHaveCount(0);
    await expect(page.getByTestId('cocrear-referencia-preview').first()).toHaveAttribute('src', /^https:\/\//);
    await expect(page.getByText('VALIDADA', { exact: true })).toBeVisible();
    await expect(page.getByTestId('cocrear-precio')).toHaveText(money);

    // Cambiar una medida: el BOM se re-escala y la validación del servidor deja de valer.
    await page.locator('label', { hasText: 'Ancho' }).locator('input').fill('1400');
    await expect(page.getByText('REQUIERE VALIDACIÓN')).toBeVisible();
    await expect(page.getByTestId('cocrear-estado-servidor')).toHaveText(/vencido/);
    expect(errores).toEqual([]);
    await context.close();
  });

  test('Vendedor: baja a BOM y costea en el servidor, ve precio y JAMÁS costo; no valida ni pasa a Costear', async ({ browser }) => {
    test.setTimeout(90_000);
    const { srv, context, page, errores } = await escenario(browser);
    await entrar(page, 'ventas@vh.mx');
    await conceptoA(page, 'Mesa de juntas de 1.35 m por 1.20 m de fondo, melamina');
    // Mueble nuevo desde cero es de Diseño/Dirección: el botón existe pero no le corresponde.
    await expect(page.getByRole('button', { name: 'Pasar a Costear →' })).toBeDisabled();
    await bajarMesaAppLT(page);
    await page.getByRole('button', { name: 'Costear en el servidor' }).click();
    await expect(page.getByTestId('cocrear-estado-servidor')).toHaveText('preliminar', { timeout: 15000 });
    await expect(page.getByTestId('cocrear-precio')).toHaveText(money);   // el precio comercial sí
    await captura(page, '2-vendedor');
    const visible = await page.locator('.coc3').innerText();
    expect(visible).not.toMatch(/Costo calculado|Costo del servidor|Cómo llegó VONI a este costo|Estimado de diseño/);
    expect(visible).toMatch(/La liberación de ingeniería requiere Diseño o Dirección/);
    // Lo que el "servidor" le contestó al vendedor no trae llaves económicas.
    const r = srv.filas.at(-1);
    expect(r.rol).toBe('vendedor');
    expect(errores).toEqual([]);
    await context.close();
  });

  test('Diseño: mueble nuevo → Pasar a Costear (análisis IA) → regresa con el BOM; lo que no tiene material queda "Por confirmar"', async ({ browser }) => {
    test.setTimeout(90_000);
    const { context, page, errores } = await escenario(browser);
    await entrar(page, 'diseno@vh.mx');
    await conceptoA(page, 'Recepción curva de 2.40 m en nogal para lobby corporativo');
    await page.getByRole('button', { name: 'Pasar a Costear →' }).click();
    await expect(page.getByTestId('costear-desde-cocrear')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#costear-descripcion')).toHaveValue(/2400 mm de ancho/);
    await captura(page, '3-costear-semilla');
    await page.getByRole('button', { name: /Analizar con Voni/ }).click();
    await expect(page.getByTestId('costear-volver-cocrear')).toBeEnabled({ timeout: 15000 });
    await page.getByTestId('costear-volver-cocrear').click();
    await expect(page.getByTestId('cocrear-bom')).toContainText('Despiece de Costear', { timeout: 15000 });
    await expect(page.getByText(/Regresó de Costear con \d+ pieza/)).toBeVisible();
    // La pieza de la propuesta no tiene material: nada de precio inventado.
    await page.getByRole('button', { name: 'Costear en el servidor' }).click();
    await expect(page.getByTestId('cocrear-estado-servidor')).toHaveText('incompleto', { timeout: 15000 });
    await expect(page.getByTestId('cocrear-precio')).toHaveText('Por confirmar');
    expect(errores).toEqual([]);
    await context.close();
  });
});
