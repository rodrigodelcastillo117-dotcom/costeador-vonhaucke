// Un insumo de SIN_MO_SECCIONES (comprado ya hecho, solo se instala) NO paga mano de obra,
// sin importar si quedó clase 'directa' o 'indirecta'. Antes, en la rama de factores explícitos,
// un SIN_MO 'directa' pagaba MO directa indebida y sobre-restaba la base indirecta (fragilidad
// latente que marcó la auditoría; protegida por el catálogo, pero real). Este test la bloquea.
import { describe, it, expect } from 'vitest';
import { calcular } from './calculo.js';

const insumosCon = (claseHerraje) => ({
  tablero: { id: 'tablero', nombre: 'MDF', seccion: 'cubiertas', clase: 'directa', unidad: 'hoja', precio: 1000, formato: { medida: 2.9768 }, fraccion: true, mermaCorte: 0 },
  herraje: { id: 'herraje', nombre: 'Herraje comprado', seccion: 'herrajes', clase: claseHerraje, unidad: 'pza', precio: 500 },
});
const pieza = () => ({
  nombre: 'X', piezas: 1, modoManoObra: 'porcentaje',
  factorDirecta: 20, factorIndirecta: 10,   // factores explícitos ⇒ rama clásica (la del fix)
  componentes: [
    { nombre: 'Panel', insumoId: 'tablero', hojas: 1, piezas: 1, cantidad: 1 },
    { nombre: 'Herraje', insumoId: 'herraje', cantidad: 1, piezas: 1 },
  ],
});
const par = { aprovechamientoCorte: 80, margenObjetivo: 40, mermaProceso: 0, modeloCosteo: 'clasico' };

describe('MO · SIN_MO no paga mano de obra sea cual sea su clase', () => {
  it('MO idéntica con herraje (sección herrajes) clase directa vs indirecta', () => {
    const rD = calcular(pieza(), 1, insumosCon('directa'), par);
    const rI = calcular(pieza(), 1, insumosCon('indirecta'), par);
    expect(rD.manoObra).toBeCloseTo(rI.manoObra, 6);
  });

  it('el herraje SIN_MO NO infla la MO (se excluye de la base aunque sea clase directa)', () => {
    const r = calcular(pieza(), 1, insumosCon('directa'), par);
    // materialDirecto incluye el herraje (clase directa), pero la base de MO lo excluye por ser SIN_MO.
    expect(r.manoObra).toBeCloseTo((r.materialDirecto - 500) * 0.20, 4);
  });
});
