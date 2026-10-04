// ============================================================================
//  E2E DE PILARES · recorre los 3 Tier-1 (COCREAR · COSTEAR · COTIZAR) con los
//  MÓDULOS REALES, de punta a punta: idea → diseño → costo → línea → totales →
//  gate de emisión. Contrato de "una sola verdad del producto" + fail-closed.
//  No reemplaza las suites por módulo; consolida el flujo completo como regresión.
//  8 + 8 + 8 = 24 pruebas.
// ============================================================================
import { describe, it, expect } from 'vitest';
import {
  interpretarIntent, extraerDNA, clasificarProducto, construirProductSpec,
  costearSpec, lineaCocreada, cocrearPayload,
  COST_STATUS,
} from './datos/cocrear.js';
import {
  calcular, precioUsable, precioVenta, calcularCostoHora, piezasPorTablero,
  PARAMETROS_DEFAULT,
} from './motor/calculo.js';
import { totalesCotizacion } from './datos/totales.js';
import { problemasDeEmision, senalesCotizacion } from './datos/senales.js';
import { razonesPorLinea, textoRazonEmision } from './componentes/Cotizacion.jsx';

// --- Fixtures compartidas (mismas que las suites por módulo) ----------------
const INSUMOS = {
  tablero: { id: 'tablero', nombre: 'Tablero melamina', seccion: 'cubiertas', clase: 'directa', unidad: 'hoja', precio: 600, formato: { medida: 2.9768 }, fraccion: true, mermaCorte: 0 },
  luz: { id: 'luz', nombre: 'Tira LED', seccion: 'electrico', clase: 'indirecta', unidad: 'm', precio: null }, // SIN precio usable
};
const PAR = { aprovechamientoCorte: 80, margenObjetivo: 40, mermaProceso: 0, modeloCosteo: 'clasico' };
const IDEA = 'Quiero una recepción curva premium en nogal, 2.40 m, para dos personas';

function specDe(componentes, rev = 1) {
  const intent = interpretarIntent(IDEA);
  return construirProductSpec(intent, extraerDNA(intent), clasificarProducto(intent, { parent: null }), { rev, componentes });
}

// ===========================================================================
//  PILAR 1 · COCREAR — idea → diseño vivo → costo honesto → línea
// ===========================================================================
describe('E2E · COCREAR', () => {
  it('1. interpreta la idea en español (familia + dimensiones)', () => {
    const intent = interpretarIntent(IDEA);
    expect(intent.familia).toBeTruthy();
    expect(intent.familia).not.toBe('DESCONOCIDA');
    expect(intent.dimensiones?.ancho_mm).toBe(2400);
  });

  it('2. el hash del spec es estable (mismos inputs ⇒ mismo hash)', () => {
    expect(specDe([], 1).hash).toBe(specDe([], 1).hash);
  });

  it('3. una revisión distinta cambia el hash (versión canónica distinta)', () => {
    expect(specDe([], 1).hash).not.toBe(specDe([], 2).hash);
  });

  it('4. sin BOM ⇒ cost_status UNKNOWN y official_cost null (nunca $0)', () => {
    const snap = costearSpec(specDe([]), INSUMOS, PAR);
    expect(snap.cost_status).toBe(COST_STATUS.UNKNOWN);
    expect(snap.official_cost).toBeNull();
  });

  it('5. BOM con insumo sin precio ⇒ PENDING_PRICE (known>0, official null)', () => {
    const snap = costearSpec(specDe([
      { nombre: 'Cubierta', insumoId: 'tablero', hojas: 1, piezas: 1, cantidad: 1 },
      { nombre: 'Tira LED', insumoId: 'luz', cantidad: 3, piezas: 1 },
    ], 2), INSUMOS, PAR);
    expect(snap.cost_status).toBe(COST_STATUS.PENDING_PRICE);
    expect(snap.official_cost).toBeNull();
    expect(snap.known_cost).toBeGreaterThan(0);
  });

  it('6. BOM completo con precios reales ⇒ KNOWN, official_cost > 0', () => {
    const snap = costearSpec(specDe([
      { nombre: 'Cubierta', insumoId: 'tablero', hojas: 1, piezas: 1, cantidad: 1 },
    ], 3), INSUMOS, PAR);
    expect(snap.cost_status).toBe(COST_STATUS.KNOWN);
    expect(snap.official_cost).toBeGreaterThan(0);
  });

  it('7. línea sin costo oficial requiere desarrollo (jamás precio inventado)', () => {
    const spec = specDe([]);
    const linea = lineaCocreada(spec, costearSpec(spec, INSUMOS, PAR));
    expect(linea.requiere_desarrollo).toBe(true);
    expect(linea.sinPrecioAutorizado).toBe(true);
  });

  it('8. payload persistible lleva costSnapshot.status (lo que lee el registro de producto)', () => {
    const intent = { ...interpretarIntent(IDEA), _componentes: [
      { nombre: 'Cubierta', insumoId: 'tablero', hojas: 1, piezas: 1, cantidad: 1 },
    ] };
    const payload = cocrearPayload({ intent, insumos: INSUMOS, par: PAR, historia: [{ rev: 1 }] });
    expect(payload.costSnapshot).toBeTruthy();
    expect(payload.costSnapshot.status).toBe(COST_STATUS.KNOWN);
    expect(payload.specHash).toBeTruthy();
  });
});

// ===========================================================================
//  PILAR 2 · COSTEAR — motor fail-closed (nunca inventa, nunca $0)
// ===========================================================================
describe('E2E · COSTEAR', () => {
  const comp = [{ nombre: 'Cubierta', insumoId: 'tablero', hojas: 1, piezas: 1, cantidad: 1 }];

  it('1. calcula un costo real > 0 con BOM y precios', () => {
    const r = calcular({ nombre: 'Mesa', piezas: 1, componentes: comp, modoManoObra: 'porcentaje' }, 1, INSUMOS, PAR);
    expect(r.costoUnitario).toBeGreaterThan(0);
  });

  it('2. precioUsable: insumo con precio ⇒ usable', () => {
    expect(precioUsable(INSUMOS.tablero)).toBe(true);
  });

  it('3. precioUsable: insumo sin precio ni precioBase ⇒ NO usable', () => {
    expect(precioUsable(INSUMOS.luz)).toBe(false);
  });

  it('4. VH-017: insumo presente SIN precio ⇒ va a componentesIgnorados (no $0 silencioso)', () => {
    const r = calcular({ nombre: 'Mesa', piezas: 1, componentes: [...comp, { nombre: 'Tira LED', insumoId: 'luz', cantidad: 3, piezas: 1 }], modoManoObra: 'porcentaje' }, 1, INSUMOS, PAR);
    expect(r.componentesIgnorados).toContain('Tira LED');
  });

  it('5. precioVenta aplica margen (precio ≥ costo)', () => {
    const { precio } = precioVenta(1000, { ...PAR, margenObjetivo: 40 });
    expect(precio).toBeGreaterThan(1000);
  });

  it('6. precioVenta fail-closed: costo no finito ⇒ NaN (no $0 barato falso)', () => {
    expect(Number.isNaN(precioVenta(Infinity, PAR).precio)).toBe(true);
  });

  it('7. piezasPorTablero devuelve un acomodo > 0 para medidas válidas', () => {
    expect(piezasPorTablero(600, 400, PARAMETROS_DEFAULT)).toBeGreaterThan(0);
  });

  it('8. calcularCostoHora deriva hora-taller > hora-nominal (eficiencia < 100%)', () => {
    const r = calcularCostoHora({ operativos: 10, jornadaSemanal: 48, nominaSemanalDirecta: 50000, eficienciaReal: 80 });
    expect(r.horaNominal).toBeGreaterThan(0);
    expect(r.horaTaller).toBeGreaterThan(r.horaNominal);
  });
});

// ===========================================================================
//  PILAR 3 · COTIZAR — totales, gate de emisión, seller-safe
// ===========================================================================
describe('E2E · COTIZAR', () => {
  const partidasOk = [
    { id: 'p1', nombre: 'Escritorio', cantidad: 2, precioUnitario: 5000, costoUnitario: 2500, margen: 50 },
    { id: 'p2', nombre: 'Credenza', cantidad: 1, precioUnitario: 8000, costoUnitario: 4000, margen: 50 },
  ];
  const cot = { descuentoPct: 0, contingenciaPct: 0, maniobrasPct: 0, fletePct: 0 };

  it('1. totalesCotizacion arma la escalera (IVA incluido, total > suma neta)', () => {
    const t = totalesCotizacion(partidasOk, cot, { ...PARAMETROS_DEFAULT, ivaPorcentaje: 16 });
    expect(t.precioLista).toBe(2 * 5000 + 8000);
    expect(t.iva).toBeGreaterThan(0);
    expect(t.total).toBeGreaterThan(t.precioLista);
  });

  it('2. problemasDeEmision bloquea una línea sin precio', () => {
    const probs = problemasDeEmision([{ id: 'x', nombre: 'X', cantidad: 1, precioUnitario: 0 }]);
    expect(probs.length).toBeGreaterThan(0);
  });

  it('3. problemasDeEmision no bloquea partidas válidas', () => {
    expect(problemasDeEmision(partidasOk).length).toBe(0);
  });

  it('4. fail-closed: precio no finito ⇒ hayLineaInvalida (no total barato falso)', () => {
    const t = totalesCotizacion([{ id: 'p', nombre: 'P', cantidad: 1, precioUnitario: Infinity }], cot, PARAMETROS_DEFAULT);
    expect(t.hayLineaInvalida).toBe(true);
  });

  it('5. gate: razonesPorLinea reparte los códigos por renglón (1-based)', () => {
    const m = razonesPorLinea({ estado: 'BLOCKED', motivos: ['linea_1_sin_product_version_id'], economics: ['linea_2_costo_desconocido'] });
    expect(m.has(1)).toBe(true);
    expect(m.has(2)).toBe(true);
  });

  it('6. gate seller-safe: traduce sin cifras de costo/margen', () => {
    const t = textoRazonEmision('linea_3_costo_desconocido');
    expect(t).toMatch(/confirmar el costo/i);
    expect(t).not.toMatch(/\$|\d+\s*%|margen|proveedor/i);
  });

  it('7. gate: códigos crudos del servidor se humanizan (nunca el código pelón)', () => {
    expect(textoRazonEmision('linea_1_producto_id_invalido')).not.toMatch(/producto_id_invalido/);
    expect(textoRazonEmision('costo_especial_desconocido')).not.toMatch(/costo_especial_desconocido/);
  });

  it('8. señales: margen por debajo del mínimo levanta alerta', () => {
    const flojo = [{ id: 'q', nombre: 'Q', cantidad: 1, precioUnitario: 1000, costoUnitario: 950, margen: 5 }];
    expect(senalesCotizacion(flojo, 25).length).toBeGreaterThan(0);
  });
});
