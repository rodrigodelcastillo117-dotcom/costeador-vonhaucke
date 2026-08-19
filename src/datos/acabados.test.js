import { describe, it, expect } from 'vitest';
import {
  MELAMINA_POR_ESPESOR, PINTURA_COLORES, MAPA_COLOR_POR_BASE,
  insumosDeAcabadosMelamina, insumosDeAcabadosPintura, coloresDe,
} from './acabados.js';
import { INSUMOS_SEMILLA, mapaInsumos } from './insumos.js';

describe('Catálogo de acabados (2026-08-18)', () => {
  it('insumosDeAcabadosMelamina() no genera ids duplicados', () => {
    const ids = insumosDeAcabadosMelamina().map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('insumosDeAcabadosPintura() no genera ids duplicados', () => {
    const ids = insumosDeAcabadosPintura().map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('el color IVORY 28mm generado ($1122.30) es el mismo dato verificado contra el T.D.C. de Alba', () => {
    const insumos = mapaInsumos(INSUMOS_SEMILLA);
    expect(insumos['melamina-28-ivory']).toBeDefined();
    expect(insumos['melamina-28-ivory'].precio).toBe(1122.3);
  });

  it('todos los insumos generados quedan realmente en INSUMOS_SEMILLA', () => {
    const insumos = mapaInsumos(INSUMOS_SEMILLA);
    for (const [espesor, colores] of Object.entries(MELAMINA_POR_ESPESOR)) {
      for (const c of colores) {
        const id = `melamina-${espesor}-${c.id}`;
        expect(insumos[id], `falta ${id}`).toBeDefined();
        expect(insumos[id].precio).toBe(c.precio);
      }
    }
    for (const c of PINTURA_COLORES) {
      const id = `pintura-polvo-${c.id}`;
      expect(insumos[id], `falta ${id}`).toBeDefined();
    }
  });

  it('MAPA_COLOR_POR_BASE apunta a ids que sí existen', () => {
    const insumos = mapaInsumos(INSUMOS_SEMILLA);
    for (const [base, porColor] of Object.entries(MAPA_COLOR_POR_BASE)) {
      for (const [colorId, insumoId] of Object.entries(porColor)) {
        expect(insumos[insumoId], `${base}[${colorId}] -> ${insumoId} no existe`).toBeDefined();
      }
    }
  });

  it('coloresDe() da la lista correcta por espesor, y null si no aplica', () => {
    expect(coloresDe('melamina-28').length).toBe(MELAMINA_POR_ESPESOR[28].length);
    expect(coloresDe('melamina-19').length).toBe(MELAMINA_POR_ESPESOR[19].length);
    expect(coloresDe('pintura-polvo').length).toBe(PINTURA_COLORES.length);
    expect(coloresDe('tapacanto')).toBeNull();
    expect(coloresDe('melamina-6')).toBeNull(); // sin compras recientes, no hay catálogo
  });
});
