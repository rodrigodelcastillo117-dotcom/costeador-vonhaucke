import { describe, it, expect } from 'vitest';
import { calcular, bomHash, diffBOM, aplicarDiffBOM } from './calculo.js';

const insumos = {
  tablero: { id: 'tablero', nombre: 'Tablero', seccion: 'cubiertas', clase: 'directa', unidad: 'hoja', precio: 600, formato: { medida: 2.9768 }, fraccion: true, mermaCorte: 0 },
  herraje: { id: 'herraje', nombre: 'Bisagra', seccion: 'herrajes', clase: 'indirecta', unidad: 'pza', precio: 50 },
};
const par = { aprovechamientoCorte: 80, mermaProceso: 0, modeloCosteo: 'clasico' };
const canon = () => [
  { nombre: 'Panel', insumoId: 'tablero', hojas: 1, piezas: 1, cantidad: 1 },
  { nombre: 'Bisagras', insumoId: 'herraje', cantidad: 2, piezas: 1 },
];
const pieza = (comps) => ({ nombre: 'M', piezas: 1, modoManoObra: 'porcentaje', componentes: comps });

describe('BOM canónico', () => {
  // 1 — mismo BOM + mismo catálogo, 10 ejecuciones => mismo costo exacto.
  it('1) 10 ejecuciones del mismo BOM/catálogo dan el mismo costo exacto', () => {
    const costos = Array.from({ length: 10 }, () => calcular(pieza(canon()), 1, insumos, par).costoUnitario);
    expect(new Set(costos).size).toBe(1);
  });

  // 2 — recalcular tras confirmaciones: el BOM no cambia salvo la partida afectada.
  it('2) aplicar un diff que afecta una partida deja intactas las demás', () => {
    const base = canon();
    const diff = diffBOM(base, [
      { nombre: 'Panel', insumoId: 'tablero', hojas: 1, piezas: 1, cantidad: 1 }, // igual
      { nombre: 'Bisagras', insumoId: 'herraje', cantidad: 4, piezas: 1 },        // cambia cantidad
    ]);
    expect(diff.modificar.map((m) => m.despues.nombre)).toEqual(['Bisagras']);
    const nuevo = aplicarDiffBOM(base, diff);
    expect(nuevo.find((c) => c.nombre === 'Panel')).toEqual(base.find((c) => c.nombre === 'Panel'));
    expect(nuevo.find((c) => c.nombre === 'Bisagras').cantidad).toBe(4);
  });

  // 3 — la IA devuelve un BOM distinto tras canonicalizar: NO reemplaza, produce diff.
  it('3) un BOM de IA distinto se detecta como diff y no muta el canónico', () => {
    const base = canon();
    const iaDistinto = [...base.map((c) => ({ ...c })), { nombre: 'Tapa extra', insumoId: 'tablero', hojas: 0.3, piezas: 1, cantidad: 1 }];
    const d = diffBOM(base, iaDistinto);
    expect(d.sinCambios).toBe(false);
    expect(d.agregar.map((c) => c.nombre)).toContain('Tapa extra');
    // No se aplicó nada: el canónico sigue con 2 partidas.
    expect(base).toHaveLength(2);
  });

  // 4 — edición manual de Diseño: la IA posterior no la revierte en silencio.
  it('4) una edición humana no se revierte sola; la IA solo propone (diff)', () => {
    const base = canon();
    // Diseño cambia el material del Panel a mano:
    const editado = base.map((c) => (c.nombre === 'Panel' ? { ...c, insumoId: 'herraje', hojas: undefined, cantidad: 1 } : c));
    // La IA posterior propone "volver" a tablero:
    const iaRevierte = canon();
    const d = diffBOM(editado, iaRevierte);
    // El revert aparece como propuesta, NO se aplica solo:
    expect(d.modificar.map((m) => m.despues.nombre)).toContain('Panel');
    // Mientras no se acepte, la edición humana sigue vigente:
    expect(editado.find((c) => c.nombre === 'Panel').insumoId).toBe('herraje');
  });

  // 5 — cambiar un precio de catálogo: hash igual, cambia solo el costo.
  it('5) cambio de precio de catálogo: bomHash igual, costo distinto', () => {
    const comps = canon();
    const h1 = bomHash(comps);
    const c1 = calcular(pieza(comps), 1, insumos, par).costoUnitario;
    const insumos2 = { ...insumos, herraje: { ...insumos.herraje, precio: 120 } };
    const c2 = calcular(pieza(comps), 1, insumos2, par).costoUnitario;
    expect(bomHash(comps)).toBe(h1);
    expect(c2).not.toBe(c1);
  });

  // 6 — cambio de geometría/cantidad confirmado: cambia el bomHash.
  it('6) cambiar cantidad/geometría cambia el bomHash', () => {
    const h1 = bomHash(canon());
    const conMasBisagras = canon().map((c) => (c.nombre === 'Bisagras' ? { ...c, cantidad: 6 } : c));
    expect(bomHash(conMasBisagras)).not.toBe(h1);
  });

  // 7 — cerrar/reabrir: mismo bomHash y mismo costo (snapshot estable al serializar).
  it('7) cerrar/reabrir (JSON round-trip) conserva hash y costo', () => {
    const comps = canon();
    const h1 = bomHash(comps);
    const c1 = calcular(pieza(comps), 1, insumos, par).costoUnitario;
    const reabierto = JSON.parse(JSON.stringify(comps)); // guardar → reabrir
    expect(bomHash(reabierto)).toBe(h1);
    expect(calcular(pieza(reabierto), 1, insumos, par).costoUnitario).toBe(c1);
  });
});
