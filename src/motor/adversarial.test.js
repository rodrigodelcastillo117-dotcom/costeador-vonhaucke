// ============================================================================
//  ADVERSARIAL DEL MOTOR (audit: "nada inválido debe producir un precio comercial
//  aparentemente válido"). Entradas basura / extremas deben SIEMPRE dar un costo
//  FINITO y fail-closed, nunca Infinity/NaN ni un $0 silencioso que parezca válido.
// ============================================================================
import { describe, it, expect } from 'vitest';
import { calcular } from './calculo.js';

const INS = {
  'mat-x': { id: 'mat-x', nombre: 'Mat X', precio: 1000, clase: 'directa', seccion: 'cubiertas', unidad: 'm2', formato: { medida: 2.9768 }, fraccion: true },
};
const comp = (o) => ({ insumoId: 'mat-x', nombre: 'Pieza', largoMM: 1000, anchoMM: 500, piezas: 1, ...o });
const pieza = (comps) => ({ nombre: 'P', componentes: comps, modoManoObra: 'porcentaje' });

describe('Motor — entradas adversariales dan costo finito y fail-closed', () => {
  it('lote NaN → n=1, costo finito', () => {
    const r = calcular(pieza([comp({})]), NaN, INS);
    expect(r.piezas).toBe(1);
    expect(Number.isFinite(r.costoUnitario)).toBe(true);
  });
  it('lote negativo (-5) → n=1, costo finito', () => {
    const r = calcular(pieza([comp({})]), -5, INS);
    expect(r.piezas).toBe(1);
    expect(Number.isFinite(r.costoUnitario)).toBe(true);
  });
  it('lote 0 → n=1', () => {
    expect(calcular(pieza([comp({})]), 0, INS).piezas).toBe(1);
  });
  it('dimensión negativa → aporta 0 (noNegativo), costo finito', () => {
    const r = calcular(pieza([comp({ largoMM: -500 })]), 1, INS);
    expect(Number.isFinite(r.costoUnitario)).toBe(true);
    expect(r.costoUnitario).toBe(0);
  });
  it('dimensión enorme → finito (no Infinity)', () => {
    const r = calcular(pieza([comp({ largoMM: 999999 })]), 1, INS);
    expect(Number.isFinite(r.costoUnitario)).toBe(true);
  });
  it('merma 100% → finito (acotada <95%, no Infinity)', () => {
    const r = calcular(pieza([comp({})]), 1, INS, { mermaProceso: 100 });
    expect(Number.isFinite(r.costoUnitario)).toBe(true);
  });
  it('merma 150% → finito', () => {
    expect(Number.isFinite(calcular(pieza([comp({})]), 1, INS, { mermaProceso: 150 }).costoUnitario)).toBe(true);
  });
  it('material inexistente → se IGNORA y se marca (fail-closed para bloquear emisión)', () => {
    const r = calcular(pieza([{ insumoId: 'no-existe', nombre: 'Huerfana', largoMM: 1000, anchoMM: 500, piezas: 1 }]), 1, INS);
    expect(r.componentesIgnorados).toContain('Huerfana');
    expect(Number.isFinite(r.costoUnitario)).toBe(true);
  });
});
