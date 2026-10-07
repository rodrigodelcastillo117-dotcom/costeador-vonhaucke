import { describe, it, expect } from 'vitest';
import { briefDeItems, briefTieneSenal } from './programaBrief.js';
import { resolverPrograma } from './resolverPrograma.js';

describe('programaBrief · salida estructurada → ProgramBrief (P0.1 · #5)', () => {
  it('mapea un privado con modelo (Eclipse Drift) a requested_models.anchor', () => {
    const b = briefDeItems([{ rol: 'privado', producto: 'Eclipse Drift 2.10', linea: 'Drift' }]);
    expect(b.privados[0].requested_models.anchor).toMatch(/drift/i);
    expect(b.privados[0].requested_line).toBe('Drift');
  });

  it('mapea juntas con dimensiones (1200×1200) y storage pedido', () => {
    const b = briefDeItems([
      { rol: 'juntas', dimensiones: '1200 x 1200' },
      { tipo: 'guarda', etiqueta: 'Gaveta pedestal' },
    ]);
    expect(b.juntas[0].requested_dimensions).toEqual({ w: 1200, d: 1200 });
    expect(b.operativosStorage).toBe(true);
  });

  it('UNKNOWN cuando no hay estructura: no inventa línea/modelo/dimensiones', () => {
    const b = briefDeItems([{ etiqueta: 'algo sin rol ni medidas' }]);
    expect(b.linea).toBeNull();
    expect(b.privados).toHaveLength(0);
    expect(b.juntas).toHaveLength(0);
    expect(briefTieneSenal(b)).toBe(false);
  });

  it('CONTRATO E2E mínimo (#5): el brief mapeado llega al resolver → Drift NEEDS_CONFIRMATION', () => {
    const brief = briefDeItems([{ rol: 'privado', producto: 'Eclipse Drift 2.10' }]);
    const r = resolverPrograma({ privados: 1, brief }, { linea: 'App LT' });
    expect(r.pendientes.some((p) => p.rol === 'privado' && p.product_status === 'NEEDS_CONFIRMATION')).toBe(true);
    expect(r.partidas.some((p) => String(p.bancoId).startsWith('dir-'))).toBe(false);  // NO sustituido
  });
});
