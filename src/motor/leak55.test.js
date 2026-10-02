import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { calcular, bomHash, formulaDePieza, FORMULA_ALBA_V1 } from './calculo.js';

const insumos = {
  t: { id: 't', nombre: 'Tablero', seccion: 'cubiertas', clase: 'directa', unidad: 'hoja', precio: 600, formato: { medida: 2.9768 }, fraccion: true },
  h: { id: 'h', nombre: 'Bisagra', seccion: 'herrajes', clase: 'indirecta', unidad: 'pza', precio: 50 },
};
const componentes = [
  { nombre: 'Panel', insumoId: 't', hojas: 1, piezas: 1, cantidad: 1 },
  { nombre: 'Bisagras', insumoId: 'h', cantidad: 2, piezas: 1 },
];
const par = { aprovechamientoCorte: 80, mermaProceso: 0, modeloCosteo: 'clasico', margenObjetivo: 40 };

// Reproduce el handoff de App.jsx: {...costeoEnBlanco(), ...b, factorDirecta: b.factorDirecta ?? null, ...}
// costeoEnBlanco ahora trae factorDirecta:null → un producto Alba (b sin factores) queda en Alba.
const costeoEnBlanco = () => ({ piezas: 1, modoManoObra: 'porcentaje', factorDirecta: null, factorIndirecta: null, margen: 40 });
const verDetalle = (b) => ({ ...costeoEnBlanco(), ...b, factorDirecta: b.factorDirecta ?? null, factorIndirecta: b.factorIndirecta ?? null });

describe('Cierre del leak Alba→55', () => {
  const bAlba = { nombre: 'Recepción', piezas: 1, componentes, modoManoObra: 'porcentaje' }; // producto nuevo = Alba

  // 1 — Alba → "Ver detalle completo" => MISMO costo al centavo.
  it('1) Ver detalle conserva el costo oficial Alba al centavo', () => {
    const oficial = calcular(bAlba, 1, insumos, par).costoUnitario;
    const detalle = verDetalle(bAlba);
    const enDetalle = calcular({ ...detalle, componentes }, 1, insumos, par).costoUnitario;
    expect(enDetalle).toBe(oficial);
  });

  // 2 — mismo bom_hash.
  it('2) Ver detalle conserva el bom_hash', () => {
    const detalle = verDetalle(bAlba);
    expect(bomHash(detalle.componentes || componentes)).toBe(bomHash(componentes));
  });

  // 3 — formula_version sigue ALBA_V1 (no se rellena con 55).
  it('3) Ver detalle sigue siendo ALBA_V1 (no Legacy55)', () => {
    const detalle = verDetalle(bAlba);
    expect(detalle.factorDirecta).toBeNull();
    expect(formulaDePieza(detalle)).toBe(FORMULA_ALBA_V1);
  });

  // 4 — mover un factor manual = SIMULACIÓN: distinguible y con otro costo (no es lo oficial).
  it('4) un factor manual produce una SIMULACIÓN distinta y etiquetable, no el costo oficial', () => {
    const sim = { ...bAlba, factorDirecta: 55, factorIndirecta: 12 };
    expect(formulaDePieza(sim)).toBe('LEGACY_55');
    expect(calcular(sim, 1, insumos, par).costoUnitario).not.toBe(calcular(bAlba, 1, insumos, par).costoUnitario);
  });

  // 6 — histórico Legacy55 reproducible (lectura).
  it('6) histórico Legacy55 sigue reproducible', () => {
    const r = calcular({ ...bAlba, factorDirecta: 55, factorIndirecta: 12 }, 1, insumos, par);
    expect(r.costoUnitario).toBeGreaterThan(0);
    expect(formulaDePieza({ factorDirecta: 55, factorIndirecta: 12 })).toBe('LEGACY_55');
  });

  // 7 — re-costear histórico con Alba cambia la fórmula y el costo (nueva revisión).
  it('7) re-costear histórico con Alba cambia fórmula y costo', () => {
    const legacy = calcular({ ...bAlba, factorDirecta: 55, factorIndirecta: 12 }, 1, insumos, par).costoUnitario;
    const alba = calcular(bAlba, 1, insumos, par).costoUnitario;
    expect(alba).not.toBe(legacy);
  });

  // 8 — GUARD DE FUENTE: ningún flujo OFICIAL de producto nuevo siembra factorDirecta=55.
  it('8) App.costeoEnBlanco y AsistenteEspecial no siembran 55 en el flujo oficial', () => {
    const app = readFileSync(fileURLToPath(new URL('../App.jsx', import.meta.url)), 'utf8');
    const i = app.indexOf('function costeoEnBlanco');
    const blanco = app.slice(i, i + 800);
    expect(blanco).not.toContain('factorDirecta: 55');
    expect(blanco).toContain('factorDirecta: null');
    const ae = readFileSync(fileURLToPath(new URL('../componentes/AsistenteEspecial.jsx', import.meta.url)), 'utf8');
    expect(ae).not.toContain('factorDirecta: 55,'); // el estado inicial / "Empezar otro" ya no lo traen
  });
});
