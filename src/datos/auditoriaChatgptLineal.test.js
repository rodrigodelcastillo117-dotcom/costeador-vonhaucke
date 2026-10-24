// ============================================================================
//  VH-AUD-201 (auditoría ChatGPT 2026-10-19): un lineal NO se adivina. Antes, si `cantidad` ≈ largoMM/1000 se suponía
//  que la IA ya había puesto los metros: 2 × 2000 mm salía 2 m (no 4) y 3 × 3000 mm salía 3 m (no 9). Dinero adivinado.
//  Contrato: largoMM = largo de UNA pieza, cantidad = NÚMERO de piezas, metrosTotales = total declarado.
//  Sin metrosTotales y con una cantidad que podría ser metros → se costea como piezas y queda REVIEW_REQUIRED.
// ============================================================================
import { describe, it, expect } from 'vitest';
import { mapIaComps } from './mapIaComps.js';
import { revisarEstructura } from './revisionEstructural.js';
import { INSUMOS_SEMILLA as INSUMOS } from './insumos.js';

const insumos = Object.fromEntries((INSUMOS || []).map((i) => [i.id, i]));
const pieza = (z) => mapIaComps({ piezas: [{ nombre: 'Base PTR', insumoId: 'ptr', material_solicitado: 'PTR', material_match: 'EXACT', confianza: 'alta', forma: 'lineal', ...z }] }, insumos)[0];

describe('VH-AUD-201 · lineales: piezas × largo, nunca por coincidencia numérica', () => {
  for (const [n, L, m] of [[1, 5000, 5], [2, 2000, 4], [3, 3000, 9], [4, 1250, 5]]) {
    it(`${n} × ${L} mm = ${m} m (con metrosTotales coherente)`, () => {
      const c = pieza({ cantidad: n, largoMM: L, metrosTotales: m });
      expect(c.cantidad).toBeCloseTo(m, 6);
      expect(c.piezasLineales).toBe(n);
      expect(c.iaIncoherencia).toBeUndefined();
    });
  }
  it('metrosTotales=5 sin largo por pieza = 5 m', () => {
    expect(pieza({ cantidad: 1, largoMM: 0, metrosTotales: 5 }).cantidad).toBe(5);
  });
  it('2 × 2000 mm sin metrosTotales: 4 m (no 2) y queda para revisión (cantidad legacy ambigua)', () => {
    const c = pieza({ cantidad: 2, largoMM: 2000 });
    expect(c.cantidad).toBe(4);
    expect(c.iaIncoherencia).toMatchObject({ campo: 'cantidadLineal' });
  });
  it('3 × 3000 mm sin metrosTotales: 9 m (no 3) y queda para revisión', () => {
    const c = pieza({ cantidad: 3, largoMM: 3000 });
    expect(c.cantidad).toBe(9);
    expect(c.iaIncoherencia).toMatchObject({ campo: 'cantidadLineal' });
  });
  it('4 × 731 mm sin metrosTotales: no es ambiguo → 2.924 m sin revisión', () => {
    const c = pieza({ cantidad: 4, largoMM: 731 });
    expect(c.cantidad).toBeCloseTo(2.924, 6);
    expect(c.iaIncoherencia).toBeUndefined();
  });
  it('cantidad no entera con largo por pieza (2.8 con 2800 mm): no son piezas → revisión', () => {
    expect(pieza({ cantidad: 2.8, largoMM: 2800 }).iaIncoherencia).toMatchObject({ campo: 'cantidadLineal' });
  });
  it('metrosTotales que no cuadra con piezas × largo → revisión (no se elige un número)', () => {
    const c = pieza({ cantidad: 2, largoMM: 2000, metrosTotales: 2 });
    expect(c.iaIncoherencia).toMatchObject({ campo: 'metrosTotales', dice: 2, puso: 4 });
  });
  it('la revisión estructural lo BLOQUEA (aceptable por una persona) con un mensaje claro', () => {
    const comps = mapIaComps({ piezas: [{ nombre: 'Base PTR', insumoId: 'ptr', material_solicitado: 'PTR', material_match: 'EXACT', confianza: 'alta', forma: 'lineal', largoMM: 2000, cantidad: 2 }] }, insumos);
    const r = revisarEstructura({ componentes: comps, insumos, descripcion: '' });
    const obs = [...(r.observaciones || []), ...(r.bloqueos || []), ...(r.obs || [])].find((o) => o.clave === 'ia_incoherente:Base PTR');
    expect(obs).toBeTruthy();
    expect(obs.nivel).toBe('blocker');
    expect(obs.mensaje).toMatch(/2 pieza\(s\) de 2000 mm = 4 m/);
  });
});

// Paridad IA → mapIaComps → intención validada (lo que recibe costear-servidor) → mismo motor.
import { intentDesdePieza, validarIntentCosteo } from './validarIntentCosteo.js';
import { calcular } from '../motor/calculo.js';
import { PARAMETROS_DEFAULT } from '../motor/calculo.js';

describe('VH-AUD-201 · paridad cliente = servidor del consumo lineal', () => {
  for (const [n, L, m] of [[2, 2000, 4], [3, 3000, 9], [4, 1250, 5]]) {
    it(`${n} × ${L} mm: el servidor recibe ${m} m y el motor cobra lo mismo en ambos lados`, () => {
      const comps = mapIaComps({ piezas: [{ nombre: 'Base PTR', insumoId: 'ptr', material_solicitado: 'PTR', material_match: 'EXACT', confianza: 'alta', forma: 'lineal', largoMM: L, cantidad: n, metrosTotales: m }] }, insumos);
      const pieza = { nombre: 'Mesa', componentes: comps };
      const v = validarIntentCosteo(intentDesdePieza(pieza, 1));
      expect(v.ok).toBe(true);
      expect(v.intent.pieza.componentes[0].cantidad).toBeCloseTo(m, 6);
      const cliente = calcular(pieza, 1, insumos, PARAMETROS_DEFAULT);
      const servidor = calcular(v.intent.pieza, 1, insumos, PARAMETROS_DEFAULT);
      expect(servidor.materialDirecto).toBeCloseTo(cliente.materialDirecto, 6);
      const uno = calcular({ nombre: 'Mesa', componentes: mapIaComps({ piezas: [{ nombre: 'Base PTR', insumoId: 'ptr', material_solicitado: 'PTR', material_match: 'EXACT', confianza: 'alta', forma: 'lineal', largoMM: 1000, cantidad: 1, metrosTotales: 1 }] }, insumos) }, 1, insumos, PARAMETROS_DEFAULT);
      expect(cliente.materialDirecto).toBeCloseTo(uno.materialDirecto * m, 4);
    });
  }
});
