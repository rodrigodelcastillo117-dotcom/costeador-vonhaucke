// Identidad del material en el costeo industrial de materia prima (auditoría del circuito):
//  (1) una pieza FABRICADA que NO es lámina de acero (MDF/melamina/madera…) no se costea en
//      silencio contra el catálogo de acero: bloquea PENDIENTE pidiendo el precio de su material.
//  (2) el tie-break "formato más barato" no se rompe cuando la fila de lámina no trae `certificable`.
import { describe, it, expect } from 'vitest';
import { costearMateriaPrima } from './costoPiezaFabricada.js';

const catAcero = [{ insumo_id: 'ln22', calibre: 22, acero: 'negra', formato: { largoMM: 3050, anchoMM: 1220 }, precio: 326.59, certificable: true }];

describe('costearMateriaPrima · identidad del material (no fail-open a acero)', () => {
  it('pieza de MELAMINA sin acero propuesto ⇒ INCOMPLETO (no se costea a precio de acero)', () => {
    const r = costearMateriaPrima(
      { clave: 'LATM', nombre: 'Lateral melamina', desc: 'Lateral melamina 18 mm', dims_mm: [600, 400], cantidad: 2 },
      { catalogoLamina: catAcero });
    expect(r.estado).toBe('INCOMPLETO');
    expect(r.motivo).toMatch(/no es lámina de acero/i);
    expect(r.componente).toBeUndefined();   // no produjo un componente costeado
  });

  it('MDF, madera, aglomerado y acrílico también bloquean', () => {
    for (const desc of ['Cubierta MDF 12mm', 'Entrepaño de madera', 'Panel aglomerado', 'Mica acrílico 6mm']) {
      const r = costearMateriaPrima({ clave: 'X', desc, dims_mm: [600, 400], cantidad: 1 }, { catalogoLamina: catAcero });
      expect(r.estado).toBe('INCOMPLETO');
      expect(r.motivo).toMatch(/no es lámina de acero/i);
    }
  });

  it('pieza de LÁMINA de acero sí se costea (no la bloquea el guard)', () => {
    const r = costearMateriaPrima(
      { clave: 'LAT', nombre: 'Lateral', desc: 'Lateral lámina calibre 22', dims_mm: [600, 400], cantidad: 2 },
      { catalogoLamina: catAcero });
    expect(['PRELIMINAR', 'VERIFICABLE']).toContain(r.estado);
    expect(r.componente).toBeTruthy();
  });

  it('acero propuesto EXPLÍCITO respeta el override aunque el texto mencione otro material', () => {
    const r = costearMateriaPrima(
      { clave: 'X', desc: 'refuerzo (melamina al frente)', aceroPropuesto: 'negra', calibrePropuesto: 22, dims_mm: [600, 400], cantidad: 1 },
      { catalogoLamina: catAcero });
    expect(r.estado).not.toBe('INCOMPLETO');   // se respeta la decisión explícita de Ingeniería
  });
});

describe('costearMateriaPrima · tie-break de formato robusto sin campo certificable', () => {
  it('elige la lámina MÁS BARATA por pieza aunque ninguna traiga certificable', () => {
    const catTie = [
      { insumo_id: 'cara',   calibre: 20, acero: 'negra', formato: { largoMM: 2000, anchoMM: 1000 }, precio: 1000 },  // sin certificable
      { insumo_id: 'barata', calibre: 20, acero: 'negra', formato: { largoMM: 3048, anchoMM: 1219 }, precio: 300 },   // sin certificable
    ];
    const r = costearMateriaPrima(
      { clave: 'P', desc: 'lámina cal 20', calibrePropuesto: 20, dims_mm: [400, 230], cantidad: 1 },
      { catalogoLamina: catTie });
    expect(r.componente?.insumoId).toBe('barata');   // antes elegía 'cara' por false===undefined
  });
});
