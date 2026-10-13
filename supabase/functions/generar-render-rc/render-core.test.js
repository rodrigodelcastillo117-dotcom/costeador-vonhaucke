import { describe, it, expect } from 'vitest';
import { normalizarEsperados, textoEsperados, preguntaConteo, bloqueGeometriaEscena, promptAuditoria } from './render-core.js';

const esperados = [
  { nombre: 'Recepción (2420 × 830 mm)', cantidad: 1, tipo: 'recepcion', w: 2420, d: 830 },
  { nombre: 'Mox · Gaveta pedestal 3 cajones', cantidad: 2, tipo: 'archivo', w: 380, d: 456 },
  { nombre: 'Silla de visita · CONCERTO', cantidad: 2, tipo: 'asiento', w: 600, d: 600 },
];
describe('VH-121 · render-core', () => {
  it('normaliza: sin sillas, cantidades enteras ≥ 1, máximo 12, medidas en mm', () => {
    const e = normalizarEsperados([...esperados, { nombre: '', cantidad: 3 }, null, { nombre: 'x', cantidad: 0.4 }]);
    expect(e.map((p) => [p.nombre.slice(0, 9), p.cantidad])).toEqual([['Recepción', 1], ['Mox · Gav', 2], ['x', 1]]);
    expect(normalizarEsperados(Array.from({ length: 20 }, (_, i) => ({ nombre: `p${i}`, cantidad: 1 })))).toHaveLength(12);
    expect(normalizarEsperados('nada')).toEqual([]);
  });
  it('texto con medidas en metros', () => {
    expect(textoEsperados(esperados)).toBe('1× Recepción (2420 × 830 mm) (2.42 × 0.83 m), 2× Mox · Gaveta pedestal 3 cajones (0.38 × 0.46 m)');
  });
  it('el contador enumera lo esperado (incluye el mostrador de recepción) y pide dígitos', () => {
    const q = preguntaConteo(esperados, 3);
    expect(q).toContain('Recepción'); expect(q).toContain('reception counter'); expect(q).toContain('3 were requested');
    expect(q).toContain('Do NOT count chairs'); expect(q).toMatch(/digits only/);
    expect(preguntaConteo([], 2)).toContain('reception counters');       // sin lista: genérico PERO con mostradores
  });
  it('bloque de geometría: medidas por pieza y número exacto de sillas del plano', () => {
    const b = bloqueGeometriaEscena({ esperados, sillas: 6 });
    expect(b).toContain('width × depth'); expect(b).toContain('2.42 × 0.83 m'); expect(b).toContain('exactly 6 chairs');
    expect(bloqueGeometriaEscena({})).toBe('');
  });
  it('auditor: con referencias juzga la geometría contra la FICHA; sin referencias no inventa; las reglas FAIL siguen', () => {
    const con = promptAuditoria({ modo: 'escena', cuarto: 'recepción', conteoPiso: 3, esperados, sillas: 2, nRefs: 2 });
    expect(con).toContain('PRODUCT REFERENCE IMAGES (2)'); expect(con).toContain('EXPECTED_CHAIRS=2'); expect(con).toContain('EXPECTED FLOOR-STANDING FURNITURE: 1× Recepción');
    for (const k of ['FAIL geometry_match', 'FAIL layout_match', 'FAIL environment_match', 'FAIL extra_objects', 'FAIL natural_camera', 'pass=true only if every relevant critical field is PASS']) expect(con).toContain(k);
    const sin = promptAuditoria({ modo: 'escena', esperados: [], nRefs: 0 });
    expect(sin).toContain('No product reference images were supplied'); expect(sin).toContain('do not invent product details'); expect(sin).not.toContain('EXPECTED FLOOR-STANDING FURNITURE');
  });
});

describe('VH-161 · contador con modelo de visión', () => {
  it('cuenta sillas además de muebles de piso y detecta 10 de 12', async () => {
    const { evaluarConteo, preguntaConteoJson } = await import('./render-core.js');
    expect(preguntaConteoJson([{ nombre: 'Módulo operativo 12u', cantidad: 1 }], 12)).toMatch(/"sillas"/);
    expect(evaluarConteo({ piso: 1, sillas: 10 }, { piso: 1, sillas: 12 })).toMatchObject({ ok: false, diferencias: ['sillas: 10 de 12'] });
    expect(evaluarConteo({ piso: 1, sillas: 12 }, { piso: 1, sillas: 12 }).ok).toBe(true);
    expect(evaluarConteo({ piso: 2, sillas: 8 }, { piso: 1, sillas: 8 }).diferencias).toEqual(['muebles de piso: 2 de 1']);
    expect(evaluarConteo(null, { piso: 1 })).toMatchObject({ ok: false, sinRespuesta: true });
    expect(evaluarConteo({ piso: 1 }, { piso: 1, sillas: null }).ok).toBe(true);   // sin sillas esperadas, no se exige
  });
});
