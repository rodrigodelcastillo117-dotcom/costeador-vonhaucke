import { describe, it, expect } from 'vitest';
import { compararHuellas, importsRelativos, cierreDeImports } from './holdoutHuellas.js';

const M = {
  archivos: { 'src/motor/calculo.js': 'a1' },
  baseDatos: { insumo_precios: { filas: 2, md5: 'p' }, sql: { catalogo_vigente: 'v' }, medido_en: '2026-10-14' },
  edges: { 'costear-servidor-rc': { version: 15, ezbr_sha256: 'e1' } },
  modelosEsperados: { 'analizar-mueble-rc': { texto: 'claude-opus-5', imagen: 'claude-opus-5-5' } },
};
const hoy = { archivos: { 'src/motor/calculo.js': 'a1' }, db: { insumo_precios: { filas: 2, md5: 'p' }, sql: { catalogo_vigente: 'v' }, medido_en: '2026-11-01' }, edges: { 'costear-servidor-rc': { version: 15, ezbr_sha256: 'e1' } },
  modelos: [{ fn: 'analizar-mueble-rc', modo: 'texto', model_id: 'claude-opus-5' }, { fn: 'analizar-mueble-rc', modo: 'imagen', model_id: 'claude-opus-5-5' }] };

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
    expect(compararHuellas(M, { ...hoy, modelos: undefined }).falta).toEqual(['modelos observados (--modelos)']);
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
});
