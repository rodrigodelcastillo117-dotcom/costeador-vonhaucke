// BLOQUE 5 (auditoría P1 "precisión aparente"): PRECISIÓN FUERA DE MUESTRA, no circular.
// Reproducir una clave con SUS factores back-fit es tautológico. La prueba honesta es
// leave-one-out: predecir una clave con los factores de las OTRAS y medir el error real.
// Resultado (evidencia, no cifra circular):
//  · El markup (cos_fab/material) va de 1.105 a 1.80 → NO hay factor universal.
//  · LOO entre productos distintos: error de 6% a 33% → el modelo NO generaliza a un
//    mueble nuevo cualquiera (por eso COSTEO OFICIAL de mueble nuevo = Nivel C, humano).
//  · LOO dentro de una MISMA familia limpia (Telcel metal ×1.35): error <1% → por FAMILIA
//    conocida sí predice (Nivel B viable). TORRE (markup 1.105) es un outlier/artefacto.
import { describe, it, expect } from 'vitest';
import data from './fixtures/claves_resumen.json';

const claves = data.claves.map((c) => ({ ...c, markup: c.cos_fab_real / c.material_real }));
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
// Predice cos_fab de una clave con el markup PROMEDIO de un conjunto que la EXCLUYE.
const looError = (target, pool) => {
  const otros = pool.filter((c) => c.clave !== target.clave);
  const pred = target.material_real * mean(otros.map((c) => c.markup));
  return (pred - target.cos_fab_real) / target.cos_fab_real * 100;
};

describe('PRECISIÓN FUERA DE MUESTRA · reproducir ≠ predecir', () => {
  it('no existe un factor universal: el markup va de 1.10 a 1.80', () => {
    const ms = claves.map((c) => c.markup);
    expect(Math.min(...ms)).toBeLessThan(1.15);
    expect(Math.max(...ms)).toBeGreaterThan(1.75);
    expect(Math.max(...ms) - Math.min(...ms)).toBeGreaterThan(0.5); // rango enorme
  });

  it('entre productos distintos NO generaliza: el peor error LOO supera 15%', () => {
    const errores = claves.map((c) => Math.abs(looError(c, claves)));
    const peor = Math.max(...errores);
    expect(peor).toBeGreaterThan(15);            // de hecho ~33% (Torre)
    // Honestidad: NINGUNA clave se predice a ±1% desde las otras → el ±1% reportado era
    // reproducción con factores propios, no precisión predictiva.
    expect(Math.min(...errores)).toBeGreaterThan(2);
  });

  it('dentro de la familia Telcel LIMPIA (×1.35, sin el outlier Torre) sí predice a <1%', () => {
    const limpia = claves.filter((c) => ['TELCEL-MOD-ALMACEN', 'TELCEL-VH-HORIZONTAL', 'TELCEL-VH-ISLA'].includes(c.clave));
    for (const c of limpia) {
      expect(Math.abs(looError(c, limpia))).toBeLessThan(1); // Nivel B por familia conocida
    }
  });

  it('TORRE es un outlier: su markup (1.105) se aparta >15% de su propia familia', () => {
    const torre = claves.find((c) => c.clave === 'TELCEL-VH-TORRE');
    const familia = claves.filter((c) => c.familia === 'telcel-metal' && c.clave !== torre.clave);
    const markupFamilia = mean(familia.map((c) => c.markup)); // ~1.35
    const desvio = Math.abs(torre.markup - markupFamilia) / markupFamilia * 100;
    expect(desvio).toBeGreaterThan(15); // factor_gif=0.005 = artefacto de ajuste a revisar
  });
});
