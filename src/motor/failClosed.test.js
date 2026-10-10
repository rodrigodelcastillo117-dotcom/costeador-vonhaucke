import { describe, it, expect } from 'vitest';
import { calcular, costeoEmitible, bomHash, diffBOM, pendientesDeCosteo } from './calculo.js';

// Catálogo mínimo para los 5 tests de integridad (audit 2026-10-01).
const insumos = {
  tablero: { id: 'tablero', nombre: 'Tablero melamina', seccion: 'cubiertas', clase: 'directa', unidad: 'hoja', precio: 600, formato: { medida: 2.9768 }, fraccion: true, mermaCorte: 0 },
  herraje: { id: 'herraje', nombre: 'Bisagra', seccion: 'herrajes', clase: 'indirecta', unidad: 'pza', precio: 50 },
};
const par = { aprovechamientoCorte: 80, margenObjetivo: 40, mermaProceso: 0, modeloCosteo: 'clasico' };

const piezaCompleta = () => ({
  nombre: 'Mueble', piezas: 1, modoManoObra: 'porcentaje',
  componentes: [
    { nombre: 'Panel', insumoId: 'tablero', hojas: 1, piezas: 1, cantidad: 1 },
    { nombre: 'Bisagras', insumoId: 'herraje', cantidad: 2, piezas: 1 },
  ],
});

describe('Integridad del costo — fail-closed + BOM canónico', () => {
  // TEST 1 — una partida sin precio ⇒ el total NO es un número oficial.
  it('1) partida sin material ⇒ no emitible, costoTotal=null, subtotal conocido > 0', () => {
    const pieza = piezaCompleta();
    pieza.componentes.push({ nombre: 'Multicontacto Byrne', insumoId: '', cantidad: 2, piezas: 1 });
    const r = calcular(pieza, 1, insumos, par);
    const e = costeoEmitible(r);
    expect(e.emitible).toBe(false);
    expect(e.costoTotal).toBeNull();
    expect(e.estadoCosto).toBe('incompleto');
    expect(e.pendientes).toContain('Multicontacto Byrne');
    expect(e.subtotalConocido).toBeGreaterThan(0);
  });

  // TEST 2 — misma revisión / mismo BOM, 10 recálculos ⇒ el MISMO costo, al centavo.
  it('2) determinismo: 10 recálculos del mismo BOM dan el mismo costo exacto', () => {
    const costos = Array.from({ length: 10 }, () => calcular(piezaCompleta(), 1, insumos, par).costoUnitario);
    expect(new Set(costos).size).toBe(1);
    expect(costos[0]).toBeGreaterThan(0);
  });

  // TEST 3 — cambiar el precio de UN insumo ⇒ solo cambia lo afectado; el BOM no se mueve.
  it('3) cambiar un precio solo mueve esa línea; el BOM (hash) no cambia', () => {
    const pieza = piezaCompleta();
    const r1 = calcular(pieza, 1, insumos, par);
    const insumos2 = { ...insumos, herraje: { ...insumos.herraje, precio: 100 } };
    const r2 = calcular(pieza, 1, insumos2, par);

    const costoTab = (r) => r.detalleInsumos.find((d) => d.insumoId === 'tablero').costo;
    const costoHer = (r) => r.detalleInsumos.find((d) => d.insumoId === 'herraje').costo;

    expect(costoTab(r2)).toBeCloseTo(costoTab(r1), 6); // la línea NO afectada no se mueve
    expect(costoHer(r2)).toBeCloseTo(costoHer(r1) * 2, 6); // solo la del herraje (50→100)
    expect(bomHash(pieza.componentes)).toBe(bomHash(pieza.componentes)); // el BOM es el mismo
  });

  // TEST 4 — "el equipo lo pone el cliente" ⇒ EXCLUIDA_CONFIRMADA, NO pendiente.
  it('4) partida excluida por decisión no cuenta como pendiente y el costo sigue emitible', () => {
    const pieza = piezaCompleta();
    pieza.componentes.push({ nombre: 'Equipo refrigerador', insumoId: '', cantidad: 1, piezas: 1, excluida: true });
    const r = calcular(pieza, 1, insumos, par);
    expect(r.componentesIgnorados).not.toContain('Equipo refrigerador');
    expect(r.componentesExcluidos).toContain('Equipo refrigerador');
    expect(costeoEmitible(r).emitible).toBe(true); // el resto sí está costeado
  });

  // TEST 5 — el BOM canónico no se reemplaza en silencio: un cambio se DETECTA (diff).
  it('5) un despiece distinto produce otro hash y un diff explícito (no reemplazo silencioso)', () => {
    const viejo = piezaCompleta().componentes;
    const nuevo = [...viejo.map((c) => ({ ...c })), { nombre: 'Jaladera', insumoId: 'herraje', cantidad: 3, piezas: 1 }];
    expect(bomHash(viejo)).not.toBe(bomHash(nuevo));
    const d = diffBOM(viejo, nuevo);
    expect(d.sinCambios).toBe(false);
    expect(d.agregar.map((c) => c.nombre)).toContain('Jaladera');
    expect(d.eliminar).toHaveLength(0);
  });

  // El hash es estable sin importar el orden de las piezas (BOM canónico).
  it('bomHash es independiente del orden de las piezas', () => {
    const a = piezaCompleta().componentes;
    const b = [...a].reverse();
    expect(bomHash(a)).toBe(bomHash(b));
  });
});

// ============================================================================
//  VH-017 · UNKNOWN != 0. Un insumo que EXISTE en el catálogo pero no tiene
//  precio usable (precio ausente y sin precioBase) NO se costea en $0: es un
//  PENDIENTE de precio, igual que un material faltante. Un precio DECLARADO
//  (incluido 0 explícito) sí es conocido (§7: "precio real = 0 válido").
// ============================================================================
describe('VH-017 — insumo presente SIN precio usable ⇒ pendiente, no $0', () => {
  const insumosBase = {
    tablero: { id: 'tablero', nombre: 'Tablero melamina', seccion: 'cubiertas', clase: 'directa', unidad: 'hoja', precio: 600, formato: { medida: 2.9768 }, fraccion: true, mermaCorte: 0 },
  };
  const parL = { aprovechamientoCorte: 80, margenObjetivo: 40, mermaProceso: 0, modeloCosteo: 'clasico' };
  const piezaCon = (compExtra) => ({
    nombre: 'Mueble', piezas: 1, modoManoObra: 'porcentaje',
    componentes: [
      { nombre: 'Panel', insumoId: 'tablero', hojas: 1, piezas: 1, cantidad: 1 },
      compExtra,
    ],
  });

  it('precio AUSENTE (null) y sin precioBase ⇒ NO emitible, costoTotal=null, listado en pendientes', () => {
    const insumos = { ...insumosBase, byrne: { id: 'byrne', nombre: 'Multicontacto Byrne', seccion: 'electrico', clase: 'directa', unidad: 'pza', precio: null } };
    const r = calcular(piezaCon({ nombre: 'Multicontacto Byrne', insumoId: 'byrne', cantidad: 2, piezas: 1 }), 1, insumos, parL);
    const e = costeoEmitible(r);
    expect(e.emitible).toBe(false);
    expect(e.costoTotal).toBeNull();
    expect(e.estadoCosto).toBe('incompleto');
    expect(e.pendientes.some((p) => /Byrne/.test(p))).toBe(true);
    expect(e.subtotalConocido).toBeGreaterThan(0);
    expect(r.detalleInsumos.some((d) => d.insumoId === 'byrne')).toBe(false);
  });

  it('ZERO declarado (precio: 0) ⇒ CONOCIDO, emitible (distingue ZERO de UNKNOWN, §7)', () => {
    const insumos = { ...insumosBase, gratis: { id: 'gratis', nombre: 'Accesorio sin costo', seccion: 'herrajes', clase: 'indirecta', unidad: 'pza', precio: 0 } };
    const r = calcular(piezaCon({ nombre: 'Accesorio sin costo', insumoId: 'gratis', cantidad: 1, piezas: 1 }), 1, insumos, parL);
    const e = costeoEmitible(r);
    expect(e.emitible).toBe(true);
    expect(e.costoTotal).toBeGreaterThan(0);
  });

  it('precioBase estimado (precio null, precioBase > 0) ⇒ CONOCIDO (estimado), emitible', () => {
    const insumos = { ...insumosBase, estim: { id: 'estim', nombre: 'Herraje estimado', seccion: 'herrajes', clase: 'indirecta', unidad: 'pza', precio: null, precioBase: 50 } };
    const r = calcular(piezaCon({ nombre: 'Herraje estimado', insumoId: 'estim', cantidad: 2, piezas: 1 }), 1, insumos, parL);
    expect(costeoEmitible(r).emitible).toBe(true);
  });

  it('cost UNKNOWN + precio de venta conocido ⇒ el costo NO es emitible (no margen 100%)', () => {
    const insumos = { ...insumosBase, byrne: { id: 'byrne', nombre: 'Multicontacto Byrne', seccion: 'electrico', clase: 'directa', unidad: 'pza', precio: null } };
    const r = calcular(piezaCon({ nombre: 'Multicontacto Byrne', insumoId: 'byrne', cantidad: 2, piezas: 1 }), 1, insumos, parL);
    expect(costeoEmitible(r).costoTotal).toBeNull();
  });
});

// ============================================================================
//  COSTEAR §3 (2026-10-10): "costos desconocidos nunca equivalen a cero".
// ============================================================================
describe('COSTEAR · completitud en la salida del motor', () => {
  it('5) componente CON material y precio pero SIN cantidad ni medidas ⇒ pendiente, no $0', () => {
    const pieza = piezaCompleta();
    pieza.componentes.push({ nombre: 'PTR 1"', insumoId: 'herraje', largoMM: 720 });   // sin anchoMM ni cantidad
    const r = calcular(pieza, 1, insumos, par);
    expect(r.estadoCosto).toBe('incompleto');
    expect(r.costoOficial).toBeNull();
    expect(r.pendientes.join(' ')).toMatch(/PTR 1".*sin cantidad ni medidas/);
    expect(costeoEmitible(r).emitible).toBe(false);
  });

  it('6) precio 0 DECLARADO sigue siendo conocido (§7) y el costeo completo', () => {
    const insumosCero = { ...insumos, herraje: { ...insumos.herraje, precio: 0 } };
    const r = calcular(piezaCompleta(), 1, insumosCero, par);
    expect(r.estadoCosto).toBe('completo');
    expect(r.costoOficial).toBe(r.costoUnitario);
  });

  it('7) costeo completo ⇒ costoOficial === costoUnitario; incompleto ⇒ costoUnitario es sólo subtotal', () => {
    const ok = calcular(piezaCompleta(), 1, insumos, par);
    expect(ok.costoOficial).toBe(ok.costoUnitario);
    const pieza = piezaCompleta();
    pieza.componentes.push({ nombre: 'Luz LED', insumoId: '', cantidad: 1 });
    const malo = calcular(pieza, 1, insumos, par);
    expect(malo.costoOficial).toBeNull();
    expect(malo.costoUnitario).toBeCloseTo(ok.costoUnitario, 6);   // el subtotal conocido no cambia
  });

  it('8) pendientesDeCosteo = la misma lista que vuelve incompleto al motor', () => {
    const pieza = piezaCompleta();
    pieza.componentes.push({ nombre: 'Luz LED', insumoId: '', cantidad: 1 });
    pieza.componentes.push({ nombre: 'Tornillos', insumoId: 'herraje' });   // sin cantidad
    const p = pendientesDeCosteo(pieza, insumos, par);
    expect(p).toEqual(calcular(pieza, 1, insumos, par).componentesIgnorados);
    expect(p).toHaveLength(2);
  });
});
