import { describe, it, expect } from 'vitest';
import {
  esCanonico, medidasAwd, vistaCanonica, identidadDe, autoridadPrecio,
  OPERATIVOS, ESCRITORIOS, JUNTAS, RECEPCIONES,
  modulosOperativosPorLinea, lineasOperativasDisponibles, METADATA_DEBT,
} from './catalogoCanonico.js';
import { BANCO } from './banco.js';

describe('catalogoCanonico · regla canónica única (P0.1 · #8)', () => {
  it('acepta módulos de la carga limpia y RECHAZA los p9-* del Excel', () => {
    expect(esCanonico({ id: 'op-10u-6000x1200-cristal' })).toBe(true);
    expect(esCanonico({ id: 'dir-1800x2400' })).toBe(true);
    expect(esCanonico({ id: 'mj-3000x1200' })).toBe(true);
    expect(esCanonico({ id: 'rec-2420x830' })).toBe(true);
    // Basura Excel: misma categoria/tipo/linea/usuarios, pero NO canónica.
    expect(esCanonico({ id: 'p9-app-lt-modulo-operativo-25980' })).toBe(false);
    expect(esCanonico({ id: 'p9-rio-modulo-operativo-15132' })).toBe(false);
    expect(esCanonico(null)).toBe(false);
    expect(esCanonico({})).toBe(false);
  });

  it('ningún p9-* se cuela en las colecciones canónicas', () => {
    const todos = [...OPERATIVOS, ...ESCRITORIOS, ...JUNTAS, ...RECEPCIONES];
    expect(todos.length).toBeGreaterThan(0);
    expect(todos.every((b) => !String(b.id).startsWith('p9-'))).toBe(true);
    expect(todos.every((b) => esCanonico(b))).toBe(true);
  });

  it('OPERATIVOS incluye el 10u real 6000×1200 y NUNCA geometría 7500', () => {
    const diez = OPERATIVOS.find((m) => Number(m.usuarios) === 10);
    expect(diez.id).toBe('op-10u-6000x1200-cristal');
    expect(medidasAwd(diez.medidas)).toEqual({ w: 6000, d: 1200 });
    expect(OPERATIVOS.some((m) => medidasAwd(m.medidas)?.w === 7500)).toBe(false);
  });

  it('preferred_line: App LT tiene módulos; una línea sin carga limpia da vacío', () => {
    expect(modulosOperativosPorLinea('App LT').length).toBeGreaterThan(0);
    expect(modulosOperativosPorLinea('Río')).toEqual([]);      // Río sólo existe como p9-*
    expect(lineasOperativasDisponibles()).toContain('App LT');
    expect(lineasOperativasDisponibles()).not.toContain('Río');
  });

  it('COMPUERTA 1 (PRODUCT_RESOLVED): vistaCanonica da geometría real, sin identidad ni precio-autoridad', () => {
    const prod = BANCO.find((b) => b.id === 'op-10u-6000x1200-cristal');
    const v = vistaCanonica(prod);
    expect(v.gate_product_resolved).toBe(true);
    expect(v.w).toBe(6000);
    expect(v).not.toHaveProperty('producto_id');     // identidad es OTRA compuerta
    expect(v).not.toHaveProperty('gate_price_authority');
    expect(vistaCanonica({ id: 'p9-app-lt-modulo-operativo-25980' })).toBeNull();
  });

  it('COMPUERTA 2 (PRODUCT_IDENTITY): identidadDe da el par versionado, no sólo source_ref', () => {
    const id = identidadDe('op-10u-6000x1200-cristal');
    expect(id).toBeTruthy();
    expect(id.producto_id).toBeTruthy();
    expect(id.producto_version_id).toBeTruthy();
    expect(id.gate_product_identity).toBe(true);
    expect(identidadDe('no-existe-xyz')).toBeNull();
  });

  it('COMPUERTA 3 (PRICE_AUTHORITY): el banco es snapshot de display, nunca autoridad', () => {
    const prod = BANCO.find((b) => b.id === 'op-10u-6000x1200-cristal');
    const p = autoridadPrecio(prod);
    expect(p.precio_lista_snapshot).toBe(28540);
    expect(p.autoridad).toBe('SERVIDOR');
    expect(p.gate_price_authority).toBe(false);       // jamás autorizado en cliente
    expect(p.price_status).toBe('SNAPSHOT_DISPLAY');
  });

  it('las tres compuertas son independientes (resuelto ≠ identidad ≠ precio)', () => {
    const prod = BANCO.find((b) => b.id === 'op-10u-6000x1200-cristal');
    expect(vistaCanonica(prod).gate_product_resolved).toBe(true);
    expect(identidadDe(prod.id).gate_product_identity).toBe(true);
    expect(autoridadPrecio(prod).gate_price_authority).toBe(false);
  });

  it('la deuda de metadata queda documentada (no silenciada)', () => {
    expect(METADATA_DEBT.problema).toMatch(/prefijo del id/i);
    expect(METADATA_DEBT.accion_definitiva).toMatch(/canonical/i);
  });
});
