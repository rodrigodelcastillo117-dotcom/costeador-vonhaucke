// P0-03 — BUG hojas:0. La IA (analizar-mueble) puede emitir `hojas:0` para un
// material lineal/por-cantidad ("0 si no aplica", dice su esquema). Antes el motor
// usaba la PRESENCIA de `hojas` como discriminador (`hojas != null`), así que
// `hojas:0` tomaba la vía de "fracción de hoja" → costo `0 × precio = $0` y hacía
// `continue`, PERDIENDO la cantidad/medida real. Un PTR de 6 m salía GRATIS.
//
// INVARIANTE que fija esta prueba: `hojas:0` debe costar EXACTAMENTE igual que si
// `hojas` no viniera, y NUNCA $0 cuando hay cantidad/medida. La fracción legítima
// (`hojas > 0`) se mantiene intacta.
import { describe, it, expect } from 'vitest';
import { calcular, costoNetoComponente, PARAMETROS_DEFAULT } from './calculo.js';

const melamina = { id: 'melamina-19', nombre: 'Melamina 19 mm', clase: 'directa', precio: 320, mermaCorte: 6, formato: { tipo: 'tablero', medida: 2.9768, largoMM: 2440, anchoMM: 1220 } };
const ptr       = { id: 'ptr', nombre: 'PTR', clase: 'directa', precio: 42, mermaCorte: 5, formato: { tipo: 'tramo', medida: 6 } };
const perfil    = { id: 'perfil', nombre: 'Perfil aluminio', clase: 'directa', precio: 80, mermaCorte: 5, formato: { tipo: 'tramo', medida: 6 } };
const tapacanto = { id: 'tapacanto', nombre: 'Tapacanto', clase: 'directa', precio: 10, mermaCorte: 4, inventario: true, formato: { tipo: 'rollo', medida: 50 } };
const lamina    = { id: 'lam10', nombre: 'Lámina cal 10', clase: 'directa', precio: 1850, mermaCorte: 3, formato: { tipo: 'hoja', medida: 79.9 }, fraccion: true };
const INS = { 'melamina-19': melamina, ptr, perfil, tapacanto, lam10: lamina };

const matDe = (r, id) => (r.detalleInsumos || []).find((d) => d.insumoId === id);

describe('P0-03 hojas:0 — material lineal/area nunca sale en $0', () => {
  const casos = [
    { et: 'PTR (tramo, 6 m)',        id: 'ptr',       comp: { insumoId: 'ptr', nombre: 'Bastidor', cantidad: 6 } },
    { et: 'Perfil (tramo)',          id: 'perfil',    comp: { insumoId: 'perfil', nombre: 'Jaladera', cantidad: 4 } },
    { et: 'Tapacanto (rollo)',       id: 'tapacanto', comp: { insumoId: 'tapacanto', nombre: 'Canto', cantidad: 12 } },
    { et: 'Tablero (área m²)',       id: 'melamina-19', comp: { insumoId: 'melamina-19', nombre: 'Cubierta', largoMM: 1600, anchoMM: 700, piezas: 1 } },
  ];

  for (const { et, id, comp } of casos) {
    it(`${et} con hojas:0 cuesta lo mismo que sin hojas y NO es $0`, () => {
      const pieza0  = { componentes: [{ ...comp, hojas: 0 }], modoManoObra: 'porcentaje' };
      const piezaSin = { componentes: [{ ...comp }], modoManoObra: 'porcentaje' };
      const r0  = calcular(pieza0, 1, INS);
      const rSin = calcular(piezaSin, 1, INS);
      const m0 = matDe(r0, id);
      expect(m0, `debe existir el insumo ${id} en el BOM`).toBeTruthy();
      expect(m0.costo, `${et} hojas:0 no puede ser $0`).toBeGreaterThan(0);
      // hojas:0 === hojas ausente (la presencia del campo no cambia el modo de consumo)
      expect(matDe(r0, id).costo).toBeCloseTo(matDe(rSin, id).costo, 6);
      expect(r0.materialDirecto).toBeCloseTo(rSin.materialDirecto, 6);
    });
  }
});

describe('P0-03 costoNetoComponente — unidad directa', () => {
  it('PTR lineal: hojas:0 → cantidad×precio (no 0)', () => {
    expect(costoNetoComponente({ cantidad: 6, hojas: 0 }, ptr, 1, PARAMETROS_DEFAULT)).toBe(6 * 42);
    expect(costoNetoComponente({ cantidad: 6 }, ptr, 1, PARAMETROS_DEFAULT)).toBe(6 * 42);
  });
  it('Tablero área: hojas:0 → m²×precio (no 0)', () => {
    // 1.0 m × 0.5 m = 0.5 m²
    expect(costoNetoComponente({ largoMM: 1000, anchoMM: 500, hojas: 0 }, melamina, 1, PARAMETROS_DEFAULT)).toBeCloseTo(0.5 * 320, 6);
  });
  it('La fracción de hoja legítima (hojas > 0) se mantiene intacta', () => {
    expect(costoNetoComponente({ hojas: 0.25 }, melamina, 1, PARAMETROS_DEFAULT)).toBeCloseTo(0.25 * 320, 6);
    expect(costoNetoComponente({ hojas: 0.8 }, lamina, 1, PARAMETROS_DEFAULT)).toBeCloseTo(0.8 * 1850, 6);
  });
});
