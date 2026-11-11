// CALIBRACIÓN contra datos REALES del concurso TELCEL DAT'S R5 (Von Haucke, 2026-11-11).
// Fuente: C-CO-320R DATS TELCEL DIV-MATERIALES (hoja de estimaciones real, material/MO/GIF/cos_fab).
//
// HALLAZGO CLAVE (verificado en 3 proyectos): el markup de FABRICACIÓN lo fija Dirección por proyecto:
//   · Telcel     → ×1.35  (MO 10% del material, GIF 25% del material)
//   · Vento      → ×1.45
//   · Exhibidor  → ×1.80  ← es el que reproduce la POLÍTICA_VH por defecto (confirmado por Dirección 2026-11-06)
// COMPRA-VENTA es ESTÁNDAR en los 3: ×1.06 (MO 1%, GIF 5%). COSTEAR ya lo reproduce exacto.
//
// Este test NO cambia la política. Documenta el dato real y prueba que el MECANISMO de override por
// proyecto (costoFabricacionVH acepta `par`) reproduce el costo real de Telcel cuando se le dan los
// factores de Telcel — sin tocar el default conservador ×1.8 (que es correcto y de Dirección).
import { describe, it, expect } from 'vitest';
import { costoFabricacionVH, POLITICA_VH } from './calculo.js';

const detalle = (fab, cv) => [
  ...(fab ? [{ seccion: 'metal', costo: fab }] : []),
  ...(cv ? [{ seccion: 'graficos', costo: cv }] : []),
];
const cerca = (a, b, tolPct = 1) => Math.abs(a - b) / b * 100 <= tolPct;

// Factores de Telcel expresados en la forma de POLÍTICA_VH:
//   fab/material = 1.35  ⇒  moFab 0.10, y gifFab tal que gifFab*(1+moFab) = 0.25  ⇒  gifFab = 0.25/1.10
// compra-venta IGUAL que el estándar (×1.06): moCV 0.01, gifCV 0.05.
const PAR_TELCEL = Object.freeze({ moFab: 0.10, gifFab: 0.25 / 1.10, moCV: 0.01, gifCV: 0.05 });

// Costo de FABRICACIÓN real por producto/sección (DIV-MATERIALES), en MXN:
//   Caja de Cobro   (fab)        material 6276.06            → cos_fab 8472.70
//   Conector Cubo   (fab)        material 3138.30            → cos_fab 4236.71
//   Horizontal      (fab + cv)   metal 4483.13 + herr 8677.20 → cos_fab 15250.05
//   Isla            (fab + cv)   metal 3297.84 + herr 12615.11 → cos_fab 17824.07
//   Almacenamiento  (fab + fab)  metal 3596.14 + herr 3376.34 → cos_fab 9412.83
const REAL = {
  caja:       { fab: 6276.06,  cv: 0,        cosFab: 8472.70 },
  conector:   { fab: 3138.30,  cv: 0,        cosFab: 4236.71 },
  horizontal: { fab: 4483.13,  cv: 8677.20,  cosFab: 15250.05 },
  isla:       { fab: 3297.84,  cv: 12615.11, cosFab: 17824.07 },
};

describe('CALIBRACIÓN · Telcel DAT\'S R5 (dato real) y el override de markup por proyecto', () => {
  it('con los factores de Telcel (×1.35), costoFabricacionVH reproduce la hoja real (±1%)', () => {
    for (const [k, v] of Object.entries(REAL)) {
      const r = costoFabricacionVH(detalle(v.fab, v.cv), PAR_TELCEL);
      expect(cerca(r.costoFabricacion, v.cosFab), `${k}: ${r.costoFabricacion} vs ${v.cosFab}`).toBe(true);
    }
  });

  it('compra-venta ×1.06 es estándar: igual en Telcel y en el default (no cambia)', () => {
    // La sección de herrajes de Horizontal ($8,677.20) da el mismo ×1.06 con cualquiera de los dos pares.
    const conTelcel = costoFabricacionVH(detalle(0, 8677.20), PAR_TELCEL).costoFabricacion;
    const conDefault = costoFabricacionVH(detalle(0, 8677.20)).costoFabricacion;
    expect(conTelcel).toBeCloseTo(conDefault, 6);
    expect(conTelcel).toBeCloseTo(8677.20 * 1.06, 1);  // 9197.83 real
  });

  it('el DEFAULT (POLÍTICA_VH ×1.8) NO se toca: aplica el markup conservador de Dirección', () => {
    // Caja de Cobro con el default: 6276.06 × 1.8 = 11,296.91 (costo conservador, calibrado a Exhibidor).
    // Es MAYOR que el real de Telcel ($8,472.70) a propósito: COSTEAR falla hacia caro, nunca hacia barato.
    const def = costoFabricacionVH(detalle(6276.06, 0)).costoFabricacion;
    expect(def).toBeCloseTo(11296.91, 0);
    expect(def).toBeGreaterThan(REAL.caja.cosFab);                 // conservador vs. el markup de Telcel
    expect(POLITICA_VH).toEqual({ moFab: 0.20, gifFab: 0.50, moCV: 0.01, gifCV: 0.05 });
  });

  it('el mecanismo de override NO altera el default (no hay efecto de borde global)', () => {
    costoFabricacionVH(detalle(1000, 0), PAR_TELCEL);             // usar un par custom...
    expect(costoFabricacionVH(detalle(1000, 0)).costoFabricacion).toBeCloseTo(1800, 6); // ...no cambia el default
  });
});
