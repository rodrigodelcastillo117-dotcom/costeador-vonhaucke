// Cargador de factores por familia: un mueble NUEVO sin hoja propia acierta con el factor
// REAL de su familia en vez de la política genérica (×1.8). Precedencia clave>familia>política,
// gobernanza (no carga sin fuente/aprobador), trazabilidad (factoresFuente) y CERO regresión.
import { describe, it, expect } from 'vitest';
import { costearBOM } from './productoMaestro.js';
import { factorDeFamilia, familiasRegistradas, cargarFactoresFamilia, FACTORES_FAMILIA } from './factoresPorFamilia.js';
import torre from './fixtures/bom/TELCEL-VH-TORRE.json';

// Mueble NUEVO (sin factor por-clave) de material metálico. Material = 1000.
const bomNuevo = (familia) => ({
  clave: 'NUEVO-X', ...(familia ? { familia } : {}), tipo_bom: 'BOM_DETALLADO_VERIFICADO',
  lineas: [{ desc: 'Lámina negra', cantidad: 1, precioConfirmado: 1000, esCompraVenta: false }],
});

describe('factorDeFamilia · solo dato real, no inventa', () => {
  it('TELCEL registrado con su fuente y aprobador', () => {
    const f = factorDeFamilia('TELCEL');
    expect(f).toMatchObject({ factor_mo: 0.10, factor_gif: 0.25, aprobado_por: 'Dirección' });
    expect(f.fuente).toMatch(/C-CO-320R/);
  });
  it('normaliza acentos/mayúsculas; familia desconocida ⇒ null (no inventa)', () => {
    expect(factorDeFamilia('  telcel ')).toBeTruthy();
    expect(factorDeFamilia('INEXISTENTE')).toBeNull();
    expect(factorDeFamilia('')).toBeNull();
    expect(factorDeFamilia(null)).toBeNull();
  });
  it('ALPURA NO está registrada como plana (usa la política ×1.8, que es su modelo real)', () => {
    expect(factorDeFamilia('ALPURA')).toBeNull();
  });
});

describe('costearBOM · precedencia de factores y trazabilidad', () => {
  it('mueble NUEVO con familia TELCEL ⇒ ×1.35 (factor de familia), NO ×1.8 genérico', () => {
    const r = costearBOM(bomNuevo('TELCEL'), {});
    expect(r.costoFabricacion).toBeCloseTo(1350, 6);   // 1000 × (1 + 0.10 + 0.25)
    expect(r.factoresFuente).toBe('familia');
    expect(r.factoresPorFamilia).toMatchObject({ familia: 'TELCEL', factor_mo: 0.10, factor_gif: 0.25 });
  });

  it('mismo mueble SIN familia ⇒ cae a la política genérica ×1.8 (este es el +33% que el cargador evita)', () => {
    const r = costearBOM(bomNuevo(null), {});
    expect(r.costoFabricacion).toBeCloseTo(1800, 6);    // 1000 × 1.8 (POLITICA_VH, todo fabricado)
    expect(r.factoresFuente).toBe('politica_vh');
    expect(r.factoresPorFamilia).toBeUndefined();
  });

  it('familia desconocida ⇒ política genérica (no inventa un factor)', () => {
    const r = costearBOM(bomNuevo('FAMILIA_FANTASMA'), {});
    expect(r.factoresFuente).toBe('politica_vh');
    expect(r.costoFabricacion).toBeCloseTo(1800, 6);
  });

  it('el factor POR CLAVE gana sobre el de familia (la hoja propia manda)', () => {
    const bom = { ...bomNuevo('TELCEL'), factor_mo: 0.20, factor_gif: 0.50 };   // factor por-clave distinto
    const r = costearBOM(bom, {});
    expect(r.factoresFuente).toBe('clave');
    expect(r.costoFabricacion).toBeCloseTo(1700, 6);   // 1000 × (1 + 0.20 + 0.50)
    expect(r.factoresPorClave).toMatchObject({ factor_mo: 0.20, factor_gif: 0.50 });
  });

  it('familia por opción (si el BOM no la trae) también resuelve', () => {
    const r = costearBOM(bomNuevo(null), {}, { familia: 'TELCEL' });
    expect(r.factoresFuente).toBe('familia');
    expect(r.costoFabricacion).toBeCloseTo(1350, 6);
  });
});

describe('cargarFactoresFamilia · gobernanza (Bloque 1 del formulario)', () => {
  it('acepta una familia con factor + fuente + aprobador; la rechaza sin respaldo', () => {
    const { tabla, aceptadas, rechazadas } = cargarFactoresFamilia([
      { familia: 'VITRINAS', factor_mo: 0.12, factor_gif: 0.30, fuente: 'cierre OP-2026-07', aprobado_por: 'Dirección' },
      { familia: 'SIN_RESPALDO', factor_mo: 0.11, factor_gif: 0.20 },                 // sin fuente/aprobador
      { familia: 'MALA', factor_mo: 'x', factor_gif: 0.2, fuente: 'a', aprobado_por: 'b' }, // factor no numérico
    ]);
    expect(aceptadas).toContain('vitrinas');
    expect(rechazadas).toHaveLength(2);
    expect(factorDeFamilia('VITRINAS', tabla)).toMatchObject({ factor_mo: 0.12, factor_gif: 0.30 });
    expect(factorDeFamilia('SIN_RESPALDO', tabla)).toBeNull();
  });

  it('la tabla cargada se usa en costearBOM vía opción tablaFactores', () => {
    const { tabla } = cargarFactoresFamilia([{ familia: 'VITRINAS', factor_mo: 0.12, factor_gif: 0.30, fuente: 'cierre OP-2026-07', aprobado_por: 'Dirección' }]);
    const r = costearBOM(bomNuevo('VITRINAS'), {}, { tablaFactores: tabla });
    expect(r.factoresFuente).toBe('familia');
    expect(r.costoFabricacion).toBeCloseTo(1420, 6);   // 1000 × (1 + 0.12 + 0.30)
  });

  it('no muta la tabla base ni inventa: FACTORES_FAMILIA sigue teniendo solo TELCEL', () => {
    cargarFactoresFamilia([{ familia: 'VITRINAS', factor_mo: 0.12, factor_gif: 0.30, fuente: 'x', aprobado_por: 'y' }]);
    expect(familiasRegistradas().map((f) => f.familia)).toEqual(['TELCEL']);
  });
});

describe('CERO regresión · los muebles con factor por-clave no cambian', () => {
  it('TORRE (factor por-clave) sigue en factoresFuente=clave y Δ 0%', () => {
    const r = costearBOM(torre, {});
    expect(r.factoresFuente).toBe('clave');
    expect(r.costoFabricacion).toBeCloseTo(torre.cos_fab_real, 1);
    expect(Math.abs(r.deltaPct)).toBeLessThanOrEqual(1);
  });

  it('determinista: dos corridas idénticas byte a byte', () => {
    expect(JSON.stringify(costearBOM(bomNuevo('TELCEL'), {}))).toBe(JSON.stringify(costearBOM(bomNuevo('TELCEL'), {})));
  });
});
