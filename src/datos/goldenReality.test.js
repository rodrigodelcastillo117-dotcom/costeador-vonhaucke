import { describe, it, expect } from 'vitest';
import { compararGolden, CAUSA_DIFERENCIA } from './goldenReality.js';

const base = () => ({
  material_canonical_id: 'melamina-19', unidad: 'hoja',
  cantidad: 2, consumo: 0.72, merma_pct: 10, precio_unitario: 544, mano_obra: 120, indirectos: 80,
});

describe('GOLDEN REALITY · compararGolden clasifica diferencias por causa (ChatGPT §13)', () => {
  it('idénticos → cuadra, sin diferencias', () => {
    const r = compararGolden(base(), base());
    expect(r.cuadra).toBe(true);
    expect(r.diferencias).toEqual([]);
  });

  it('precio distinto → causa PRECIO', () => {
    const r = compararGolden(base(), { ...base(), precio_unitario: 560 });
    const d = r.diferencias.find((x) => x.campo === 'precio_unitario');
    expect(d.causa).toBe(CAUSA_DIFERENCIA.PRECIO);
    expect(d.delta).toBeCloseTo(16, 5);
  });

  it('material canónico distinto → IDENTIDAD_MP', () => {
    const r = compararGolden(base(), { ...base(), material_canonical_id: 'melamina-16' });
    expect(r.porCausa[CAUSA_DIFERENCIA.IDENTIDAD_MP]).toBe(1);
  });

  it('unidad distinta → UNIDAD', () => {
    const r = compararGolden(base(), { ...base(), unidad: 'm2' });
    expect(r.porCausa[CAUSA_DIFERENCIA.UNIDAD]).toBe(1);
  });

  it('merma distinta → MERMA; MO distinta → MANO_OBRA; indirectos → INDIRECTOS', () => {
    const r = compararGolden(base(), { ...base(), merma_pct: 15, mano_obra: 150, indirectos: 100 });
    expect(r.porCausa[CAUSA_DIFERENCIA.MERMA]).toBe(1);
    expect(r.porCausa[CAUSA_DIFERENCIA.MANO_OBRA]).toBe(1);
    expect(r.porCausa[CAUSA_DIFERENCIA.INDIRECTOS]).toBe(1);
  });

  it('tipo_cambio distinto → MONEDA_FX', () => {
    const r = compararGolden({ ...base(), tipo_cambio: 17.5 }, { ...base(), tipo_cambio: 18.2 });
    expect(r.porCausa[CAUSA_DIFERENCIA.MONEDA_FX]).toBe(1);
  });

  it('diferencia minúscula (1 centavo) → REDONDEO, soloRedondeo', () => {
    const r = compararGolden(base(), { ...base(), precio_unitario: 544.004 });
    expect(r.soloRedondeo).toBe(true);
    expect(r.diferencias.every((d) => d.causa === CAUSA_DIFERENCIA.REDONDEO)).toBe(true);
  });

  it('un lado sin el dato → DATO_FALTANTE (no se inventa)', () => {
    const h = base(); const a = { ...base() }; delete a.indirectos;
    const r = compararGolden(h, a);
    const d = r.diferencias.find((x) => x.campo === 'indirectos');
    expect(d.causa).toBe(CAUSA_DIFERENCIA.DATO_FALTANTE);
  });

  it('NO cuadra artificialmente: una diferencia real NO se marca como redondeo', () => {
    const r = compararGolden(base(), { ...base(), consumo: 0.9 });  // 25% más
    expect(r.soloRedondeo).toBe(false);
    expect(r.porCausa[CAUSA_DIFERENCIA.CONSUMO]).toBe(1);
  });

  it('DETERMINISTA: mismas entradas → mismo resultado', () => {
    expect(compararGolden(base(), { ...base(), precio_unitario: 560 }))
      .toEqual(compararGolden(base(), { ...base(), precio_unitario: 560 }));
  });
});
