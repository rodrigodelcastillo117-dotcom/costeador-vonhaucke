import { describe, it, expect } from 'vitest';
import { patchMedidas, consumePorSuperficie } from './medidasMaterial.js';
import { calcular, costeoEmitible } from '../motor/calculo.js';

// VH-167: el librero 5×8 (Operación 10/10). La persona eligió para "Laterales" el tablero ERP
// AME28152 WALNUT 5×8 (precio por HOJA, sin formato en producción). El cliente borró 1800×350 y el motor
// cobró una hoja completa ($1,924.20) en lugar de dejarlo pendiente por P0-02.
const erp5x8SinFormato = { id: 'erp-ame28152-b709', nombre: 'AGLOMERADO MELAMINA DOS CARAS HOJA 5 X 8 ESPESOR 28 mm · WALNUT', seccion: 'cubiertas', unidad: 'hoja', precio: 1924.2, precioBase: 1924.2, clase: 'directa', fraccion: false, mermaCorte: 0, formato: null };
const bisagra = { id: 'bisagra', nombre: 'Bisagra', seccion: 'herrajes', unidad: 'pza', precio: 20, precioBase: 20, clase: 'indirecta', formato: null };
const lateral = { nombre: 'Laterales', insumoId: 'melamina-28-walnut', largoMM: 1800, anchoMM: 350, piezas: 2, cantidad: 1 };

describe('VH-167 · cambiar de material nunca borra la medida de la pieza', () => {
  it('un tablero por HOJA (aunque no traiga formato) conserva largo × ancho', () => {
    expect(consumePorSuperficie(erp5x8SinFormato)).toBe(true);
    expect(patchMedidas(lateral, erp5x8SinFormato)).toEqual({});
  });
  it('con la medida conservada, el motor deja la pieza PENDIENTE (P0-02), no cobra "1 hoja"', () => {
    const pieza = { ...lateral, ...patchMedidas(lateral, erp5x8SinFormato), insumoId: erp5x8SinFormato.id };
    const r = calcular({ nombre: 'librero', modoManoObra: 'porcentaje', componentes: [pieza] }, 1, { [erp5x8SinFormato.id]: erp5x8SinFormato });
    expect(r.componentesIgnorados.join(' ')).toMatch(/Laterales.*sin formato/);
    expect(costeoEmitible(r).emitible).toBe(false);
    expect((r.detalleInsumos || []).find((d) => d.insumoId === erp5x8SinFormato.id)?.costo || 0).toBe(0);
  });
  it('lo que hacía antes (medida borrada) cobraba la hoja entera: queda documentado', () => {
    const borrada = { ...lateral, largoMM: undefined, anchoMM: undefined, insumoId: erp5x8SinFormato.id };
    const r = calcular({ nombre: 'librero', modoManoObra: 'porcentaje', componentes: [borrada] }, 1, { [erp5x8SinFormato.id]: erp5x8SinFormato });
    expect(r.componentesIgnorados).toEqual([]);   // por eso el defecto pasaba sin aviso
  });
  it('un material por pieza saca la medida del consumo, pero la guarda y se restaura al volver a un tablero', () => {
    const p1 = { ...lateral, ...patchMedidas(lateral, bisagra) };
    expect(p1.largoMM).toBeUndefined(); expect(p1.medidaPrevia).toEqual({ largoMM: 1800, anchoMM: 350 });
    const p2 = { ...p1, ...patchMedidas(p1, erp5x8SinFormato) };
    expect(p2.largoMM).toBe(1800); expect(p2.anchoMM).toBe(350); expect(p2.medidaPrevia).toBeUndefined();
  });
  it('sin insumo no toca nada', () => { expect(patchMedidas(lateral, null)).toEqual({}); });
});
