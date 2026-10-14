import { describe, it, expect } from 'vitest';
import { compararHuellas } from './holdoutHuellas.js';

const M = {
  archivos: { 'src/motor/calculo.js': 'a1' },
  baseDatos: { insumo_precios: { filas: 2, md5: 'p' }, sql: { catalogo_vigente: 'v' }, medido_en: '2026-10-14' },
  edges: { 'costear-servidor-rc': { version: 15, ezbr_sha256: 'e1' } },
};
const hoy = { archivos: { 'src/motor/calculo.js': 'a1' }, db: { insumo_precios: { filas: 2, md5: 'p' }, sql: { catalogo_vigente: 'v' }, medido_en: '2026-11-01' }, edges: { 'costear-servidor-rc': { version: 15, ezbr_sha256: 'e1' } } };

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
});
