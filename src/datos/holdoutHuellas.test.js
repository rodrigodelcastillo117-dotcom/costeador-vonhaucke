import { describe, it, expect } from 'vitest';
import { compararHuellas, importsRelativos, cierreDeImports, auditarLlamadasCorrida, unirCorrida, costeableDeHoja, argumentosViteValidos } from './holdoutHuellas.js';

const M = {
  archivos: { 'src/motor/calculo.js': 'a1' },
  baseDatos: { insumo_precios: { filas: 2, md5: 'p' }, sql: { catalogo_vigente: 'v' }, medido_en: '2026-10-14' },
  edges: { 'costear-servidor-rc': { version: 15, ezbr_sha256: 'e1' } },
  modelosEsperados: { 'analizar-mueble-rc': { texto: 'claude-opus-5', imagen: 'claude-opus-5-5' } },
  frontendSha: 'abc1234def',
  entornoVite: { BASE_URL: '/', DEV: true, MODE: 'development', PROD: false, SSR: false, VITE_ANALIZAR_MUEBLE_FN: 'analizar-mueble-rc', VITE_COSTEAR_FN: 'costear-servidor-rc' },
};
// v5: la corrida se describe con la auditoría de llamadas de cada hoja (E2E) + su 0-binario.json.
const edgesHoja = [
  { fn: 'analizar-mueble-rc', body: { request_id: 'r1' } }, { fn: 'analizar-mueble-rc', body: { request_id: 'r2' } },
  { fn: 'costear-servidor-rc', body: { ok: true } },
];
const binario = { shaApp: 'abc1234', shaGit: 'abc1234', baseURL: 'http://localhost:5173/', fecha: '2026-11-01T10:00:00Z', reintento: 0, arbolLimpio: true,
  entornoVite: { BASE_URL: '/', DEV: true, MODE: 'development', PROD: false, SSR: false, VITE_ANALIZAR_MUEBLE_FN: 'analizar-mueble-rc', VITE_COSTEAR_FN: 'costear-servidor-rc' },
  configPlaywright: 'playwright.config.js', servidor: { mismoCheckout: true, argumentos: ['--max-old-space-size=8192', '--port', '5173', '--strictPort'] } };
// v5.2: cada hoja trae su FIXTURE leída de git en el SHA servido (ruta + sha256 + datos); el E2E declara la misma ruta y sha.
const HOJA = { texto: 'Pata tipo "u" de 600 x 720 mm', clave_erp: 'ATPU2M' };
const fixtureDe = (datos = HOJA, ruta = 'lab/costear/ciego_erp/hojas/ATPU2M.json') => ({ ruta, sha256: `sha-${JSON.stringify(datos).length}-${ruta.length}`, datos });
const FX = fixtureDe();
const declaradaDe = (fx = FX) => ({ ruta: fx.ruta, sha256: fx.sha256 });
const corridaDe = (edges, extra = {}, fx = FX) => unirCorrida([{ auditoria: auditarLlamadasCorrida(edges, { hoja: declaradaDe(fx), costeable: costeableDeHoja(fx.datos), ...extra }), binario, crudas: edges, fixture: fx }]);
const hojaDe = (auditoria, crudas, extra = {}) => ({ auditoria: { ...auditoria, hoja: auditoria?.hoja ?? declaradaDe() }, binario, crudas, fixture: FX, ...extra });
const hoy = { archivos: { 'src/motor/calculo.js': 'a1' }, db: { insumo_precios: { filas: 2, md5: 'p' }, sql: { catalogo_vigente: 'v' }, medido_en: '2026-11-01' }, edges: { 'costear-servidor-rc': { version: 15, ezbr_sha256: 'e1' } },
  modelos: [{ fn: 'analizar-mueble-rc', modo: 'texto', model_id: 'claude-opus-5', request_id: 'r1' }, { fn: 'analizar-mueble-rc', modo: 'imagen', model_id: 'claude-opus-5-5', request_id: 'r2' }],
  corrida: corridaDe(edgesHoja), cambiosGit: [] };

describe('Holdout v2 · congelamiento verificable (fail-closed)', () => {
  it('archivos, base y Edge idénticos ⇒ OK (la fecha de medición no cuenta)', () => {
    expect(compararHuellas(M, hoy)).toEqual({ estado: 'OK', cambios: [], falta: [] });
  });
  it('sin huellas de base o de Edge ⇒ NO_VERIFICADO aunque los archivos coincidan (antes decía OK)', () => {
    expect(compararHuellas(M, { archivos: hoy.archivos }).estado).toBe('NO_VERIFICADO');
    expect(compararHuellas(M, { ...hoy, edges: null }).falta).toEqual(['versiones de Edge (--edges)']);
  });
  it('un cambio de confidence/vigente_desde en precios (md5 distinto) invalida el holdout', () => {
    const r = compararHuellas(M, { ...hoy, db: { ...hoy.db, insumo_precios: { filas: 2, md5: 'otro' } } });
    expect(r.estado).toBe('CAMBIO'); expect(r.cambios[0]).toMatch(/base de datos/);
  });
  it('la definición de catalogo_vigente cambió ⇒ invalida', () => {
    expect(compararHuellas(M, { ...hoy, db: { ...hoy.db, sql: { catalogo_vigente: 'nueva' } } }).estado).toBe('CAMBIO');
  });
  it('Edge redesplegada (otra versión o SHA) ⇒ invalida', () => {
    expect(compararHuellas(M, { ...hoy, edges: { 'costear-servidor-rc': { version: 16, ezbr_sha256: 'e2' } } }).cambios).toEqual(['edge costear-servidor-rc']);
  });
  it('un archivo de motor cambiado ⇒ invalida', () => {
    expect(compararHuellas(M, { ...hoy, archivos: { 'src/motor/calculo.js': 'b2' } }).cambios).toEqual(['archivo src/motor/calculo.js']);
  });
  it('el orden de las llaves del JSON de la base no importa', () => {
    expect(compararHuellas(M, { ...hoy, db: { sql: { catalogo_vigente: 'v' }, insumo_precios: { md5: 'p', filas: 2 } } }).estado).toBe('OK');
  });
  // ---- v3 (reauditoría v2, P1-02) ----
  it('MODELO: un modelo observado distinto al esperado (variable de entorno cambiada, mismo SHA de Edge) ⇒ CAMBIO', () => {
    const r = compararHuellas(M, { ...hoy, modelos: [{ fn: 'analizar-mueble-rc', modo: 'imagen', model_id: 'claude-sonnet-5-5' }] });
    expect(r.estado).toBe('CAMBIO');
    expect(r.cambios).toEqual(['modelo analizar-mueble-rc/imagen: claude-sonnet-5-5 (esperado claude-opus-5-5)']);
    expect(compararHuellas(M, { ...hoy, modelos: [{ fn: 'analizar-mueble-rc', modo: 'revision', model_id: 'claude-opus-5-5' }] }).cambios[0]).toMatch(/esperado ninguno/);
    expect(compararHuellas(M, { ...hoy, modelos: [{ fn: 'analizar-mueble-rc', modo: 'texto', model_id: null }] }).estado).toBe('CAMBIO');
  });
  it('sin modelos observados, o un manifiesto sin modelos esperados ⇒ NO_VERIFICADO (registrar no es congelar)', () => {
    expect(compararHuellas(M, { ...hoy, modelos: undefined }).falta).toEqual(['modelos observados (--modelos, no vacío)', 'evento de IA (ai_eventos con función, modo y model_id) para 2 request(s): r1, r2']);
    const { modelosEsperados, ...sinModelos } = M;
    expect(compararHuellas(sinModelos, hoy).estado).toBe('NO_VERIFICADO');
  });
  it('CIERRE DE IMPORTS: lo que importa una entrada entra al congelamiento aunque nadie lo haya listado', () => {
    const fs = {
      'src/datos/revisionEstructural.js': "import { reglas } from './reglasTaller.js';\nexport const x = 1;",
      'src/datos/reglasTaller.js': "export * from '../motor/medidas';",
      'src/motor/medidas.js': "import pkg from 'react'; const m = await import('./dinamico.js');",
      'src/motor/dinamico.js': '',
      'src/datos/insumos.js': "import { ACABADOS } from './acabados.js'; import './efecto.js';",
      'src/datos/acabados.js': '', 'src/datos/efecto.js': '',
    };
    const leer = (f) => (f in fs ? fs[f] : null);
    expect(importsRelativos(fs['src/datos/insumos.js'])).toEqual(['./acabados.js', './efecto.js']);
    expect(cierreDeImports(['src/datos/revisionEstructural.js', 'src/datos/insumos.js'], leer)).toEqual([
      'src/datos/acabados.js', 'src/datos/efecto.js', 'src/datos/insumos.js', 'src/datos/reglasTaller.js',
      'src/datos/revisionEstructural.js', 'src/motor/dinamico.js', 'src/motor/medidas.js',
    ]);
    expect(cierreDeImports(['a.js'], (f) => (f === 'a.js' ? "import x from './no-existe.js'" : null))).toEqual(['FALTA:no-existe.js', 'a.js']);
  });
  // ---- v4 (reauditoría v3, P1-02) ----
  it('modelos = [] (ventana vacía o telemetría caída) ⇒ NO_VERIFICADO, nunca OK', () => {
    const r = compararHuellas(M, { ...hoy, modelos: [] });
    expect(r.estado).toBe('NO_VERIFICADO');
    expect(r.falta).toContain('modelos observados (--modelos, no vacío)');
  });
  it('cada request de IA de la corrida necesita su evento (función, modo y model_id); sin --corrida no verifica', () => {
    const tres = corridaDe([...edgesHoja, { fn: 'analizar-mueble-rc', body: { request_id: 'r3' } }]);
    expect(compararHuellas(M, { ...hoy, corrida: tres }).falta).toEqual(['evento de IA (ai_eventos con función, modo y model_id) para 1 request(s): r3',
      'eventos de IA (2) ≠ llamadas de IA (3)']);
    expect(compararHuellas(M, { ...hoy, corrida: undefined }).falta).toEqual(['auditoría de la corrida (--corrida)']);
    // un evento con el request_id pero sin modo NO cuenta como evidencia
    const sinModo = [{ fn: 'analizar-mueble-rc', model_id: 'claude-opus-5', request_id: 'r1' }, hoy.modelos[1]];
    expect(compararHuellas(M, { ...hoy, modelos: sinModo }).estado).not.toBe('OK');
    expect(compararHuellas(M, hoy).estado).toBe('OK');
  });
  // ---- v5 (cierre pre-deploy 14-oct) ----
  it('A · una llamada de IA SIN request_id ⇒ NO_VERIFICADO (antes `.filter(Boolean)` la borraba y daba OK)', () => {
    const conHueco = [...edgesHoja, { fn: 'analizar-mueble-rc', body: { ok: true } }];
    const a = auditarLlamadasCorrida(conHueco);
    expect(a.ia).toEqual({ llamadas: 3, request_ids: ['r1', 'r2', null], sin_id: 1 });
    expect(a.motivos).toEqual(['1 de 3 llamada(s) de IA sin request_id']);
    const r = compararHuellas(M, { ...hoy, corrida: corridaDe(conHueco) });
    expect(r.estado).toBe('NO_VERIFICADO'); expect(r.falta).toContain('1 llamada(s) de IA sin request_id');
    // lo que el E2E v4 escribía (ids filtrados) ya no se acepta como corrida: no trae cuántas llamadas hubo
    expect(compararHuellas(M, { ...hoy, corrida: { ia: { llamadas: 3, request_ids: ['r1', 'r2'], sin_id: 0 }, costeo: hoy.corrida.costeo, binarios: [binario] } }).falta)
      .toContain('request_id (2) ≠ llamadas de IA (3)');
  });
  it('B · costeo con la Edge de PRODUCCIÓN (costear-servidor) ⇒ CAMBIO; caso costeable sin llamada RC ⇒ NO_VERIFICADO', () => {
    const conProd = [...edgesHoja, { fn: 'costear-servidor', body: {} }];
    expect(auditarLlamadasCorrida(conProd).motivos).toEqual(['costeo con Edge distinta de costear-servidor-rc: costear-servidor']);
    const r = compararHuellas(M, { ...hoy, corrida: corridaDe(conProd) });
    expect(r.estado).toBe('CAMBIO'); expect(r.cambios).toEqual(['costeo con Edge ajena: costear-servidor']);
    const sinRc = edgesHoja.filter((e) => e.fn !== 'costear-servidor-rc');
    expect(auditarLlamadasCorrida(sinRc).motivos).toEqual(['caso costeable sin ninguna llamada a costear-servidor-rc']);
    const r2 = compararHuellas(M, { ...hoy, corrida: corridaDe(sinRc) });
    expect(r2.estado).toBe('NO_VERIFICADO'); expect(r2.falta).toContain('1 caso(s) costeable(s) sin llamada a costear-servidor-rc');
    // sólo una hoja CONGELADA que se declara no costeable (con motivo) pasa sin llamada RC (v5.2: no el resumen ni el entorno)
    const noCost = fixtureDe({ ...HOJA, costeable: false, motivo_no_costeable: 'mueble de catálogo sin despiece: se cotiza, no se costea' });
    expect(compararHuellas(M, { ...hoy, corrida: corridaDe(sinRc, {}, noCost) }).estado).toBe('OK');
    // una hoja sin auditoría (E2E viejo o que tronó antes del final) no verifica
    expect(compararHuellas(M, { ...hoy, corrida: unirCorrida([{ binario }]) }).falta).toContain('1 hoja(s) sin auditoría de llamadas');
  });
  it('C · binario: SHA del navegador ≠ git, sin 0-binario, o código cambiado entre el SHA congelado y el servido ⇒ no OK', () => {
    const otro = { ...binario, shaApp: 'fff0000' };
    expect(compararHuellas(M, { ...hoy, corrida: unirCorrida([hojaDe(auditarLlamadasCorrida(edgesHoja), edgesHoja, { binario: otro })]) }).cambios)
      .toEqual(['binario: el navegador sirvió fff0000 y git era abc1234']);
    expect(compararHuellas(M, { ...hoy, corrida: unirCorrida([hojaDe(auditarLlamadasCorrida(edgesHoja), edgesHoja, { binario: undefined })]) }).falta).toContain('evidencia del binario (0-binario.json)');
    expect(compararHuellas(M, { ...hoy, cambiosGit: ['src/App.jsx'] }).cambios).toEqual(['código cambiado después del congelamiento: src/App.jsx']);
    expect(compararHuellas(M, { ...hoy, cambiosGit: ['RELEASE_9_5_GATE.md', 'lab/costear/holdout_intelisis/MANIFIESTO.json'] }).estado).toBe('OK');
    expect(compararHuellas(M, { ...hoy, cambiosGit: undefined }).falta).toContain('diferencias git entre el SHA congelado y el servido');
    const { frontendSha, ...sinSha } = M;
    expect(compararHuellas(sinSha, hoy).falta).toContain('SHA del frontend en el MANIFIESTO');
  });
  // ---- v5.1 (reauditoría final): el verificador no confía en el resumen de llamadas ----
  // Cada uno de estos casos daba OK con la v5: el verificador leía `ajenas` y `rc` de llamadas.json tal cual.
  const conProd = [...edgesHoja, { fn: 'costear-servidor', body: {} }];
  it('D · resumen con porFn {costear-servidor: 1} pero ajenas [] ⇒ CAMBIO (la Edge ajena se deriva de porFn)', () => {
    const a = auditarLlamadasCorrida(conProd);
    const r = compararHuellas(M, { ...hoy, corrida: unirCorrida([hojaDe({ ...a, costeo: { ...a.costeo, ajenas: [] }, motivos: [] }, conProd)]) });
    expect(r.estado).toBe('CAMBIO'); expect(r.cambios).toEqual(['costeo con Edge ajena: costear-servidor']);
    // y declarar otra fnEsperada en el archivo no la vuelve "propia": la RC esperada está fija en el verificador
    const r2 = compararHuellas(M, { ...hoy, corrida: unirCorrida([hojaDe({ ...a, costeo: { ...a.costeo, fnEsperada: 'costear-servidor', ajenas: [] } }, conProd)]) });
    expect(r2.cambios).toEqual(['costeo con Edge ajena: costear-servidor']);
  });
  it('E · resumen que borra la llamada de producción pero las llamadas crudas la tienen ⇒ CAMBIO y NO cuadra', () => {
    const limpio = auditarLlamadasCorrida(edgesHoja);   // resumen "limpio" de otra corrida
    const r = compararHuellas(M, { ...hoy, corrida: unirCorrida([hojaDe(limpio, conProd)]) });
    expect(r.estado).toBe('CAMBIO');
    expect(r.cambios).toEqual(['costeo con Edge ajena: costear-servidor']);
    expect(r.falta).toContain('1 hoja(s) cuyo llamadas.json no cuadra con sus llamadas crudas (edges.json)');
  });
  it('F · hoja sin llamadas crudas (edges.json) ⇒ NO_VERIFICADO: el resumen solo no basta', () => {
    const r = compararHuellas(M, { ...hoy, corrida: unirCorrida([hojaDe(auditarLlamadasCorrida(edgesHoja), undefined)]) });
    expect(r.estado).toBe('NO_VERIFICADO'); expect(r.falta).toEqual(['1 hoja(s) sin llamadas crudas (edges.json)']);
  });
  it('G · resumen con rc: 5 pero sin ninguna llamada RC (en porFn ni en crudas) ⇒ NO_VERIFICADO', () => {
    const sinRc = edgesHoja.filter((e) => e.fn !== 'costear-servidor-rc');
    const a = auditarLlamadasCorrida(sinRc);
    const r = compararHuellas(M, { ...hoy, corrida: unirCorrida([hojaDe({ ...a, costeo: { ...a.costeo, rc: 5 }, motivos: [] }, sinRc)]) });
    expect(r.estado).toBe('NO_VERIFICADO');
    expect(r.falta).toEqual(expect.arrayContaining(['1 caso(s) costeable(s) sin llamada a costear-servidor-rc', '1 hoja(s) cuyo llamadas.json no cuadra con sus llamadas crudas (edges.json)']));
  });
  it('H · request_id del resumen distinto al de la llamada cruda (o una llamada de IA de más en crudas) ⇒ NO_VERIFICADO', () => {
    const a = auditarLlamadasCorrida(edgesHoja);
    const otroId = { ...a, ia: { ...a.ia, request_ids: ['r1', 'r9'] } };
    expect(compararHuellas(M, { ...hoy, corrida: unirCorrida([hojaDe(otroId, edgesHoja)]) }).falta)
      .toContain('1 hoja(s) cuyo llamadas.json no cuadra con sus llamadas crudas (edges.json)');
    const extra = [...edgesHoja, { fn: 'analizar-mueble-rc', request_id: null, body: '{"ok":true' }];
    expect(compararHuellas(M, { ...hoy, corrida: unirCorrida([hojaDe(a, extra)]) }).estado).toBe('NO_VERIFICADO');
  });
  it('las llamadas crudas como las guarda el E2E (body recortado como texto, request_id aparte) cuadran y dan OK', () => {
    const guardadas = edgesHoja.map((e) => ({ ...e, ...(/^analizar-mueble/.test(e.fn) ? { request_id: e.body.request_id } : {}), body: JSON.stringify(e.body).slice(0, 6000) }));
    expect(compararHuellas(M, { ...hoy, corrida: unirCorrida([hojaDe(auditarLlamadasCorrida(edgesHoja), guardadas)]) }).estado).toBe('OK');
  });
  // ---- v5.2 (reauditoría GO/NO-GO): request_id 1:1, costeable desde la hoja congelada, assert final de Edge ----
  // I, I2, J y K daban OK (o no compilaban: costeableDeHoja no existía) con la v5.1. L ya pasaba: documenta el assert final.
  it('I · request_id REPETIDO (dos llamadas de IA con el mismo id y un solo evento) ⇒ NO_VERIFICADO', () => {
    const dup = [{ fn: 'analizar-mueble-rc', body: { request_id: 'r1' } }, { fn: 'analizar-mueble-rc', body: { request_id: 'r1' } }, { fn: 'costear-servidor-rc', body: {} }];
    expect(auditarLlamadasCorrida(dup).motivos).toEqual(['request_id repetido en las llamadas de IA: r1']);
    const r = compararHuellas(M, { ...hoy, modelos: [hoy.modelos[0]], corrida: corridaDe(dup) });
    expect(r.estado).toBe('NO_VERIFICADO');
    expect(r.falta).toContain('request_id repetido (1): r1');
    // repetido ENTRE hojas también: la unicidad es de la corrida completa
    const otraHoja = [{ fn: 'analizar-mueble-rc', body: { request_id: 'r1' } }, { fn: 'costear-servidor-rc', body: {} }];
    const dos = unirCorrida([hojaDe(auditarLlamadasCorrida(edgesHoja), edgesHoja), hojaDe(auditarLlamadasCorrida(otraHoja), otraHoja)]);
    expect(compararHuellas(M, { ...hoy, corrida: dos }).falta).toContain('request_id repetido (1): r1');
  });
  it('I2 · eventos ≠ llamadas: dos eventos para un request, o un evento que no es de la corrida ⇒ NO_VERIFICADO', () => {
    const r = compararHuellas(M, { ...hoy, modelos: [...hoy.modelos, { ...hoy.modelos[0] }] });
    expect(r.estado).toBe('NO_VERIFICADO');
    expect(r.falta).toEqual(['más de un evento de IA para 1 request(s): r1', 'eventos de IA (3) ≠ llamadas de IA (2)']);
    const ajeno = [...hoy.modelos, { fn: 'analizar-mueble-rc', modo: 'texto', model_id: 'claude-opus-5', request_id: 'r9' }];
    expect(compararHuellas(M, { ...hoy, modelos: ajeno }).falta).toEqual(['1 evento(s) de IA que no son de esta corrida: r9', 'eventos de IA (3) ≠ llamadas de IA (2)']);
  });
  it('J · ATAQUE: fixture costeable + resumen "no costeable" (LAB_COSTEABLE=0) + 0 llamadas RC ⇒ NO_VERIFICADO', () => {
    const sinRc = edgesHoja.filter((e) => e.fn !== 'costear-servidor-rc');
    // el E2E v5.1 escribía costeable:false con LAB_COSTEABLE=0; la hoja congelada en git no dice eso
    const r = compararHuellas(M, { ...hoy, corrida: corridaDe(sinRc, { costeable: false }) });
    expect(r.estado).toBe('NO_VERIFICADO');
    expect(r.falta).toEqual(expect.arrayContaining(['1 caso(s) costeable(s) sin llamada a costear-servidor-rc',
      '1 hoja(s) cuyo llamadas.json declara "costeable" distinto de su hoja congelada']));
  });
  it('K · hoja sin fixture congelada, fixture distinta de la que corrió, o costeable:false SIN motivo ⇒ no OK', () => {
    const a = auditarLlamadasCorrida(edgesHoja, { hoja: declaradaDe() });
    const sinFx = '1 hoja(s) sin fixture congelada (ruta + sha256 en git al SHA servido)';
    expect(compararHuellas(M, { ...hoy, corrida: unirCorrida([{ auditoria: a, binario, crudas: edgesHoja }]) }).falta).toContain(sinFx);
    expect(compararHuellas(M, { ...hoy, corrida: unirCorrida([{ auditoria: { ...a, hoja: null }, binario, crudas: edgesHoja, fixture: FX }]) }).falta).toContain(sinFx);
    const r = compararHuellas(M, { ...hoy, corrida: unirCorrida([{ auditoria: { ...a, hoja: { ...a.hoja, sha256: 'otra' } }, binario, crudas: edgesHoja, fixture: FX }]) });
    expect(r.estado).toBe('CAMBIO'); expect(r.cambios).toEqual(['hoja distinta de la que corrió el E2E: lab/costear/ciego_erp/hojas/ATPU2M.json']);
    const sinMotivo = fixtureDe({ ...HOJA, costeable: false });
    const sinRc = edgesHoja.filter((e) => e.fn !== 'costear-servidor-rc');
    const r2 = compararHuellas(M, { ...hoy, corrida: corridaDe(sinRc, {}, sinMotivo) });
    expect(r2.estado).toBe('NO_VERIFICADO');
    expect(r2.falta).toEqual(expect.arrayContaining(['1 hoja(s) con "costeable" inválido (false exige motivo_no_costeable)', '1 caso(s) costeable(s) sin llamada a costear-servidor-rc']));
  });
  it('costeableDeHoja: ausente o true ⇒ costeable; false con motivo ⇒ no costeable; cualquier otra cosa ⇒ indefinido (null)', () => {
    expect(costeableDeHoja({})).toBe(true); expect(costeableDeHoja({ costeable: true })).toBe(true);
    expect(costeableDeHoja({ costeable: false, motivo_no_costeable: 'sin despiece' })).toBe(false);
    for (const h of [null, [], { costeable: 'no' }, { costeable: 0 }, { costeable: false }, { costeable: false, motivo_no_costeable: '  ' }]) expect(costeableDeHoja(h)).toBeNull();
  });
  it('L · ASSERT FINAL: costear-servidor (producción) en la transferencia, al reabrir o al recostear ⇒ CAMBIO', () => {
    // El E2E junta TODAS las respuestas de la página desde el primer paso, espera a que la red quede en reposo y audita al
    // final: no importa en qué paso apareció la llamada.
    for (const paso of ['transferencia a Cotizar', 'reapertura', 'recosteo con dificultad']) {
      const tarde = [...edgesHoja, { fn: 'costear-servidor-rc', body: {} }, { fn: 'costear-servidor', body: {}, paso }];
      expect(auditarLlamadasCorrida(tarde).motivos).toEqual(['costeo con Edge distinta de costear-servidor-rc: costear-servidor']);
      const r = compararHuellas(M, { ...hoy, corrida: corridaDe(tarde) });
      expect(r.estado).toBe('CAMBIO'); expect(r.cambios).toEqual(['costeo con Edge ajena: costear-servidor']);
    }
    expect(compararHuellas(M, { ...hoy, corrida: corridaDe([...edgesHoja, { fn: 'costear-servidor-rc2', body: {} }]) }).cambios).toEqual(['costeo con Edge ajena: costear-servidor-rc2']);
  });
  // ---- v5.3 (auditoría binaria del FINAL_SHA, P1): el arnés que decide si la prueba pasa también está congelado ----
  it('M · ATAQUE: el SHA servido sólo cambia playwright.config.js (retries 0 → 5) ⇒ CAMBIO (antes daba OK)', () => {
    const r = compararHuellas(M, { ...hoy, cambiosGit: ['playwright.config.js'] });
    expect(r.estado).toBe('CAMBIO');
    expect(r.cambios).toEqual(['código cambiado después del congelamiento: playwright.config.js']);
    // la documentación sigue sin contar: el holdout congela lo ejecutable
    expect(compararHuellas(M, { ...hoy, cambiosGit: ['docs/auditoria/baseline_prod.sql', 'RELEASE_9_5_GATE.md'] }).estado).toBe('OK');
  });
  it('N · la evidencia salió de un REINTENTO de Playwright (CI=1, --retries o config) ⇒ CAMBIO; sin `reintento` ⇒ NO_VERIFICADO', () => {
    const conReintento = { ...binario, reintento: 1 };
    const r = compararHuellas(M, { ...hoy, corrida: unirCorrida([hojaDe(auditarLlamadasCorrida(edgesHoja), edgesHoja, { binario: conReintento })]) });
    expect(r.estado).toBe('CAMBIO');
    expect(r.cambios).toEqual(['evidencia de un reintento de Playwright (reintento 1): sólo vale el primer intento']);
    const { reintento, ...sinCampo } = binario;
    const v = compararHuellas(M, { ...hoy, corrida: unirCorrida([hojaDe(auditarLlamadasCorrida(edgesHoja), edgesHoja, { binario: sinCampo })]) });
    expect(v.estado).toBe('NO_VERIFICADO');
    expect(v.falta).toContain('intento de la prueba en 0-binario.json (reintento)');
  });
  it('O · la corrida se sirvió con cambios SIN COMMIT (p. ej. vite.config.js editado sin commit, mismo SHA) ⇒ CAMBIO; sin dato ⇒ NO_VERIFICADO', () => {
    const sucio = { ...binario, arbolLimpio: false };
    const r = compararHuellas(M, { ...hoy, corrida: unirCorrida([hojaDe(auditarLlamadasCorrida(edgesHoja), edgesHoja, { binario: sucio })]) });
    expect(r.estado).toBe('CAMBIO');
    expect(r.cambios).toEqual(['binario: la corrida se sirvió con cambios sin commit en el árbol de git']);
    const { arbolLimpio, ...sinDato } = binario;
    expect(compararHuellas(M, { ...hoy, corrida: unirCorrida([hojaDe(auditarLlamadasCorrida(edgesHoja), edgesHoja, { binario: sinDato })]) }).falta)
      .toContain('estado del árbol de git en 0-binario.json (arbolLimpio)');
  });
  it('P · el servidor de desarrollo sirvió OTRO entorno (un .env ignorado, VITE_CONTROL_OPTIMISTA, otra Edge) ⇒ CAMBIO; sin dato ⇒ NO_VERIFICADO', () => {
    const conExtra = { ...binario, entornoVite: { ...binario.entornoVite, VITE_CONTROL_OPTIMISTA: '1' } };
    expect(compararHuellas(M, { ...hoy, corrida: unirCorrida([hojaDe(auditarLlamadasCorrida(edgesHoja), edgesHoja, { binario: conExtra })]) }).cambios)
      .toEqual(['entorno de Vite distinto al congelado: VITE_CONTROL_OPTIMISTA']);
    const otraEdge = { ...binario, entornoVite: { ...binario.entornoVite, VITE_COSTEAR_FN: 'costear-servidor' } };
    expect(compararHuellas(M, { ...hoy, corrida: unirCorrida([hojaDe(auditarLlamadasCorrida(edgesHoja), edgesHoja, { binario: otraEdge })]) }).cambios)
      .toEqual(['entorno de Vite distinto al congelado: VITE_COSTEAR_FN']);
    const { entornoVite, ...sinDato } = binario;
    expect(compararHuellas(M, { ...hoy, corrida: unirCorrida([hojaDe(auditarLlamadasCorrida(edgesHoja), edgesHoja, { binario: sinDato })]) }).falta)
      .toContain('entorno de Vite servido en 0-binario.json (entornoVite)');
    const { entornoVite: _e, ...manifiestoViejo } = M;
    expect(compararHuellas(manifiestoViejo, hoy).falta).toContain('entorno de Vite esperado en el MANIFIESTO');
  });

  // ---- v5.4 (revisión propia del cierre v5.3): el config que Playwright CARGÓ y el servidor que contestó ----
  const conBinario = (b) => ({ ...hoy, corrida: unirCorrida([hojaDe(auditarLlamadasCorrida(edgesHoja), edgesHoja, { binario: b })]) });
  it('Q · ATAQUE: un playwright.config.ts SIN versionar (Playwright lo carga antes que el .js congelado) ⇒ CAMBIO; sin dato ⇒ NO_VERIFICADO', () => {
    const r = compararHuellas(M, conBinario({ ...binario, configPlaywright: 'playwright.config.ts' }));
    expect(r.estado).toBe('CAMBIO');
    expect(r.cambios).toEqual(['Playwright cargó playwright.config.ts, no el config congelado (playwright.config.js)']);
    expect(compararHuellas(M, conBinario({ ...binario, configPlaywright: 'otro/playwright.config.js' })).estado).toBe('CAMBIO');
    const { configPlaywright, ...sinDato } = binario;
    const v = compararHuellas(M, conBinario(sinDato));
    expect(v.estado).toBe('NO_VERIFICADO');
    expect(v.falta).toContain('config de Playwright cargado en 0-binario.json (configPlaywright)');
  });
  it('R · el Vite que contestó es de OTRO checkout, o se lanzó con otra raíz, --config o --import ⇒ CAMBIO; sin dato ⇒ NO_VERIFICADO', () => {
    expect(compararHuellas(M, conBinario({ ...binario, servidor: { ...binario.servidor, mismoCheckout: false } })).cambios)
      .toEqual(['el servidor de Vite que contestó no es de este checkout']);
    for (const argumentos of [['/otro/checkout', '--port', '5173'], ['--config', '/tmp/vite.otro.js'], ['--import', '/tmp/parche.mjs'], ['--mode', 'production'], ['--port']]) {
      const r = compararHuellas(M, conBinario({ ...binario, servidor: { mismoCheckout: true, argumentos } }));
      expect(r.estado, argumentos.join(' ')).toBe('CAMBIO');
      expect(r.cambios).toEqual([`servidor de Vite lanzado con argumentos no permitidos: ${argumentos.join(' ')}`]);
    }
    // como lo lanzan vite_rc.sh (`vite --port 5173 --strictPort`) y el webServer del config (`npm run dev` ⇒ `vite`)
    expect(compararHuellas(M, conBinario({ ...binario, servidor: { mismoCheckout: true, argumentos: [] } })).estado).toBe('OK');
    const { servidor, ...sinDato } = binario;
    for (const b of [sinDato, { ...binario, servidor: null }, { ...binario, servidor: { mismoCheckout: true } }]) {
      const v = compararHuellas(M, conBinario(b));
      expect(v.estado).toBe('NO_VERIFICADO');
      expect(v.falta).toContain('servidor de Vite que contestó en 0-binario.json (servidor)');
    }
  });
  it('argumentosViteValidos: lista permitida (puerto, strictPort, force, memoria de node); todo lo demás no', () => {
    expect(argumentosViteValidos([])).toBe(true);
    expect(argumentosViteValidos(['--port', '5173', '--strictPort'])).toBe(true);
    expect(argumentosViteValidos(['--port=5173', '--force', '--max-old-space-size=8192'])).toBe(true);
    for (const a of [null, undefined, 'vite', ['--port'], ['--port', 'x'], ['5173'], ['.'], ['--host'], ['-c', 'x'], ['--require', 'x'], ['--loader=x'], ['--max-old-space-size']]) expect(argumentosViteValidos(a), JSON.stringify(a)).toBe(false);
  });
});
