import { describe, it, expect } from 'vitest';
import { conAcompanantes } from './autoInsumos.js';

describe('conAcompanantes — adhesivo automático de superficie sólida', () => {
  it('solid surface sin adhesivo → agrega el adhesivo', () => {
    const r = conAcompanantes([{ nombre: 'Cubierta', insumoId: 'solid-surface', largoMM: 3600, anchoMM: 750 }]);
    expect(r.some((c) => c.insumoId === 'adhesivo-solid-surface' && c._auto)).toBe(true);
  });
  it('variante azul también dispara el adhesivo', () => {
    const r = conAcompanantes([{ nombre: 'Cubierta', insumoId: 'solid-surface-azul' }]);
    expect(r.some((c) => c.insumoId === 'adhesivo-solid-surface')).toBe(true);
  });
  it('si el adhesivo ya está, no lo duplica', () => {
    const base = [{ insumoId: 'solid-surface' }, { insumoId: 'adhesivo-solid-surface', cantidad: 3 }];
    const r = conAcompanantes(base);
    expect(r.filter((c) => c.insumoId === 'adhesivo-solid-surface').length).toBe(1);
    expect(r.find((c) => c.insumoId === 'adhesivo-solid-surface').cantidad).toBe(3); // respeta el del usuario
  });
  it('sin superficie sólida → no agrega nada', () => {
    const base = [{ insumoId: 'mdf-16' }, { insumoId: 'ptr' }];
    expect(conAcompanantes(base)).toHaveLength(2);
  });
  it('entrada vacía o basura → no rompe', () => {
    expect(conAcompanantes()).toEqual([]);
    expect(conAcompanantes(null)).toEqual([]);
    expect(conAcompanantes([null, { insumoId: '' }])).toHaveLength(2);
  });
  it('no muta el arreglo de entrada', () => {
    const base = [{ insumoId: 'solid-surface' }];
    conAcompanantes(base);
    expect(base).toHaveLength(1);
  });
});

// VH-180 · lab credenza 2026-10-13 (BOM real de la IA): "Canto visible" / material "Canto nogal" no tenía familia; la
// regla de casa agregaba "Tapacanto (cantos visibles)" 32.64 m APARTE y el renglón de la IA (12 m, sin material) dejaba
// el costo del servidor en "incompleto". Debe quedar UN solo renglón de canto, con el metraje de la regla de casa.
import credenza from './fixtures/credenza_canto_ia.json';
import { INSUMOS_SEMILLA, mapaInsumos } from './insumos.js';
describe('VH-180 · el canto que la IA nombra "Canto …" es el mismo renglón que la regla de casa', () => {
  it('credenza: un solo renglón de canto vivo, con el metraje por geometría', () => {
    const r = conAcompanantes(credenza.componentes.map((c) => ({ ...c })), mapaInsumos(INSUMOS_SEMILLA));
    const cantos = r.filter((c) => c && !c.excluida && /canto/i.test(`${c.nombre} ${c.material_solicitado || ''}`));
    expect(cantos).toHaveLength(1);
    expect(cantos[0].cantidad).toBeGreaterThan(20);           // regla de casa (32.64 m en el lab), no los 12 m supuestos
    expect(cantos[0]._regla).toBe('tapacanto');
  });
});


describe('TELCEL · niveladores: regla de casa idempotente', () => {
  const insumos = mapaInsumos(INSUMOS_SEMILLA);
  const base = [
    { nombre: 'Base / patas metálicas', insumoId: 'ptr', material_solicitado: 'PTR', forma: 'lineal', cantidad: 2 },
    { nombre: 'Niveladores cónicos 3/8', insumoId: '', material_solicitado: 'Nivelador cónico cromado 3/8', material_match: 'NOT_AVAILABLE', cantidad: 4, forma: 'pieza' },
  ];
  it('si VONI ya trae niveladores, la regla NO agrega una segunda línea', () => {
    const r = conAcompanantes(base, insumos);
    const niv = r.filter((c) => /nivelador/i.test(`${c?.nombre || ''} ${c?.material_solicitado || ''}`));
    expect(niv).toHaveLength(1);
  });
  it('aplicar acompañantes dos veces no duplica niveladores', () => {
    const r1 = conAcompanantes(base, insumos);
    const r2 = conAcompanantes(r1, insumos);
    const niv = r2.filter((c) => /nivelador/i.test(`${c?.nombre || ''} ${c?.material_solicitado || ''}`));
    expect(niv).toHaveLength(1);
  });
});
