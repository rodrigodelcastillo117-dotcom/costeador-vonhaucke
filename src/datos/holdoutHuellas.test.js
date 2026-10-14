import { describe, it, expect } from 'vitest';
import { compararHuellas, importsRelativos, cierreDeImports, auditarLlamadasCorrida, unirCorrida } from './holdoutHuellas.js';

const M = {
  archivos: { 'src/motor/calculo.js': 'a1' },
  baseDatos: { insumo_precios: { filas: 2, md5: 'p' }, sql: { catalogo_vigente: 'v' }, medido_en: '2026-10-14' },
  edges: { 'costear-servidor-rc': { version: 15, ezbr_sha256: 'e1' } },
  modelosEsperados: { 'analizar-mueble-rc': { texto: 'claude-opus-5', imagen: 'claude-opus-5-5' } },
  frontendSha: 'abc1234def',
};
// v5: la corrida se describe con la auditoría de llamadas de cada hoja (E2E) + su 0-binario.json.
const edgesHoja = [
  { fn: 'analizar-mueble-rc', body: { request_id: 'r1' } }, { fn: 'analizar-mueble-rc', body: { request_id: 'r2' } },
  { fn: 'costear-servidor-rc', body: { ok: true } },
];
const binario = { shaApp: 'abc1234', shaGit: 'abc1234', baseURL: 'http://localhost:5173/', fecha: '2026-11-01T10:00:00Z' };
const corridaDe = (edges, extra = {}) => unirCorrida([{ auditoria: auditarLlamadasCorrida(edges, extra), binario, crudas: edges }]);
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
    expect(compararHuellas(M, { ...hoy, corrida: tres }).falta).toEqual(['evento de IA (ai_eventos con función, modo y model_id) para 1 request(s): r3']);
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
    // sólo un caso declarado no costeable puede pasar sin llamada (se registra; no se infiere)
    expect(compararHuellas(M, { ...hoy, corrida: corridaDe(sinRc, { costeable: false }) }).estado).toBe('OK');
    // una hoja sin auditoría (E2E viejo o que tronó antes del final) no verifica
    expect(compararHuellas(M, { ...hoy, corrida: unirCorrida([{ binario }]) }).falta).toContain('1 hoja(s) sin auditoría de llamadas');
  });
  it('C · binario: SHA del navegador ≠ git, sin 0-binario, o código cambiado entre el SHA congelado y el servido ⇒ no OK', () => {
    const otro = { ...binario, shaApp: 'fff0000' };
    expect(compararHuellas(M, { ...hoy, corrida: unirCorrida([{ auditoria: auditarLlamadasCorrida(edgesHoja), binario: otro, crudas: edgesHoja }]) }).cambios)
      .toEqual(['binario: el navegador sirvió fff0000 y git era abc1234']);
    expect(compararHuellas(M, { ...hoy, corrida: unirCorrida([{ auditoria: auditarLlamadasCorrida(edgesHoja), crudas: edgesHoja }]) }).falta).toContain('evidencia del binario (0-binario.json)');
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
    const r = compararHuellas(M, { ...hoy, corrida: unirCorrida([{ auditoria: { ...a, costeo: { ...a.costeo, ajenas: [] }, motivos: [] }, binario, crudas: conProd }]) });
    expect(r.estado).toBe('CAMBIO'); expect(r.cambios).toEqual(['costeo con Edge ajena: costear-servidor']);
    // y declarar otra fnEsperada en el archivo no la vuelve "propia": la RC esperada está fija en el verificador
    const r2 = compararHuellas(M, { ...hoy, corrida: unirCorrida([{ auditoria: { ...a, costeo: { ...a.costeo, fnEsperada: 'costear-servidor', ajenas: [] } }, binario, crudas: conProd }]) });
    expect(r2.cambios).toEqual(['costeo con Edge ajena: costear-servidor']);
  });
  it('E · resumen que borra la llamada de producción pero las llamadas crudas la tienen ⇒ CAMBIO y NO cuadra', () => {
    const limpio = auditarLlamadasCorrida(edgesHoja);   // resumen "limpio" de otra corrida
    const r = compararHuellas(M, { ...hoy, corrida: unirCorrida([{ auditoria: limpio, binario, crudas: conProd }]) });
    expect(r.estado).toBe('CAMBIO');
    expect(r.cambios).toEqual(['costeo con Edge ajena: costear-servidor']);
    expect(r.falta).toContain('1 hoja(s) cuyo llamadas.json no cuadra con sus llamadas crudas (edges.json)');
  });
  it('F · hoja sin llamadas crudas (edges.json) ⇒ NO_VERIFICADO: el resumen solo no basta', () => {
    const r = compararHuellas(M, { ...hoy, corrida: unirCorrida([{ auditoria: auditarLlamadasCorrida(edgesHoja), binario }]) });
    expect(r.estado).toBe('NO_VERIFICADO'); expect(r.falta).toEqual(['1 hoja(s) sin llamadas crudas (edges.json)']);
  });
  it('G · resumen con rc: 5 pero sin ninguna llamada RC (en porFn ni en crudas) ⇒ NO_VERIFICADO', () => {
    const sinRc = edgesHoja.filter((e) => e.fn !== 'costear-servidor-rc');
    const a = auditarLlamadasCorrida(sinRc);
    const r = compararHuellas(M, { ...hoy, corrida: unirCorrida([{ auditoria: { ...a, costeo: { ...a.costeo, rc: 5 }, motivos: [] }, binario, crudas: sinRc }]) });
    expect(r.estado).toBe('NO_VERIFICADO');
    expect(r.falta).toEqual(expect.arrayContaining(['1 caso(s) costeable(s) sin llamada a costear-servidor-rc', '1 hoja(s) cuyo llamadas.json no cuadra con sus llamadas crudas (edges.json)']));
  });
  it('H · request_id del resumen distinto al de la llamada cruda (o una llamada de IA de más en crudas) ⇒ NO_VERIFICADO', () => {
    const a = auditarLlamadasCorrida(edgesHoja);
    const otroId = { ...a, ia: { ...a.ia, request_ids: ['r1', 'r9'] } };
    expect(compararHuellas(M, { ...hoy, corrida: unirCorrida([{ auditoria: otroId, binario, crudas: edgesHoja }]) }).falta)
      .toContain('1 hoja(s) cuyo llamadas.json no cuadra con sus llamadas crudas (edges.json)');
    const extra = [...edgesHoja, { fn: 'analizar-mueble-rc', request_id: null, body: '{"ok":true' }];
    expect(compararHuellas(M, { ...hoy, corrida: unirCorrida([{ auditoria: a, binario, crudas: extra }]) }).estado).toBe('NO_VERIFICADO');
  });
  it('las llamadas crudas como las guarda el E2E (body recortado como texto, request_id aparte) cuadran y dan OK', () => {
    const guardadas = edgesHoja.map((e) => ({ ...e, ...(/^analizar-mueble/.test(e.fn) ? { request_id: e.body.request_id } : {}), body: JSON.stringify(e.body).slice(0, 6000) }));
    expect(compararHuellas(M, { ...hoy, corrida: unirCorrida([{ auditoria: auditarLlamadasCorrida(edgesHoja), binario, crudas: guardadas }]) }).estado).toBe('OK');
  });
});
