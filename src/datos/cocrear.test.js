// ============================================================================
//  COCREAR · tests de aceptación del vertical slice (contrato §16-§19 + VH-017).
//  Verifican que el orquestador: (1) corre el pipeline completo de la Golden #1,
//  (2) clasifica línea/configurada/derivada/nueva preservando linaje, (3) es
//  HONESTO con lo que no sabe (no finge costo/ingeniería), (4) bloquea un Smart
//  Locker eléctrico no certificado.
// ============================================================================
import { describe, it, expect } from 'vitest';
import {
  interpretarIntent, clasificarProducto, construirProductSpec, extraerDNA,
  costearSpec, lineaCocreada, manufacturabilidad, estadoIngenieria, cocrear, estaStale,
  CLASIFICACION, COST_STATUS, ENG_STATUS, MFG_STATUS, COCREO_STATUS, FAMILIA,
} from './cocrear.js';

const GOLDEN = 'Quiero una recepción cálida, premium, curva, 2.40 m, nogal oscuro, cubierta clara, iluminación integrada y espacio para dos personas.';

describe('COCREAR · ProductIntent (parse determinista, no inventa)', () => {
  const intent = interpretarIntent(GOLDEN);
  it('familia = RECEPCION', () => expect(intent.familia).toBe(FAMILIA.RECEPCION));
  it('dimensión 2.40 m = 2400 mm', () => expect(intent.dimensiones.ancho_mm).toBe(2400));
  it('nogal con tono oscuro', () => expect(intent.materiales).toContainEqual({ material: 'nogal', tono: 'oscuro' }));
  it('cubierta clara como acabado', () => expect(intent.acabados).toContainEqual({ rol: 'cubierta', tono: 'claro' }));
  it('iluminación integrada y curva como features', () => {
    expect(intent.caracteristicas).toContain('iluminacion_integrada');
    expect(intent.caracteristicas).toContain('curva');
  });
  it('capacidad 2 personas', () => expect(intent.capacidad.personas).toBe(2));
  it('ADN: premium + cálido', () => { expect(intent.nivel).toBe('premium'); expect(intent.tono).toBe('calido'); });
  it('lo que no se dice NO se inventa (un brief vacío lista desconocidos)', () => {
    const vago = interpretarIntent('quiero algo bonito');
    expect(vago.familia).toBe(FAMILIA.DESCONOCIDA);
    expect(vago.desconocidos).toContain('familia');
    expect(vago.desconocidos).toContain('dimensiones');
    expect(vago.dimensiones).toBeNull();
  });
});

describe('COCREAR · clasificación de producto (§17, linaje)', () => {
  // Producto de catálogo "Cirque" con un set de colores permitidos.
  const cirque = { id: 'cirque', version: 'v1', nombre: 'Cirque', familia: FAMILIA.ESCRITORIO,
    dimensiones: { ancho_mm: 1500 }, materialesPermitidos: ['laminado'], coloresPermitidos: ['blanco', 'negro', 'nogal'] };

  it('Cirque + color permitido = CONFIGURED_LINE_PRODUCT', () => {
    const intent = { materiales: [{ material: 'nogal', tono: null }], caracteristicas: [], dimensiones: { ancho_mm: 1500 } };
    const c = clasificarProducto(intent, { parent: cirque });
    expect(c.clasificacion).toBe(CLASIFICACION.CONFIGURED_LINE_PRODUCT);
    expect(c.parent_product_id).toBe('cirque');
  });

  it('Cirque + 300mm + solid surface + iluminación + estructural = DERIVED_SPECIAL (conserva linaje)', () => {
    const intent = { materiales: [{ material: 'solid_surface', tono: null }],
      caracteristicas: ['iluminacion_integrada', 'estructural'], dimensiones: { ancho_mm: 1800 } };
    const c = clasificarProducto(intent, { parent: cirque });
    expect(c.clasificacion).toBe(CLASIFICACION.DERIVED_SPECIAL);
    expect(c.parent_product_id).toBe('cirque');
    expect(c.parent_product_version).toBe('v1');
    // Conserva el change_set (qué cambió respecto al padre).
    expect(c.change_set.some((x) => x.tipo === 'dimensional')).toBe(true);
    expect(c.change_set.some((x) => x.tipo === 'material')).toBe(true);
    expect(c.change_set.some((x) => x.tipo === 'feature')).toBe(true);
  });

  it('sin padre = NEW_SPECIAL', () => {
    const c = clasificarProducto(interpretarIntent(GOLDEN), { parent: null });
    expect(c.clasificacion).toBe(CLASIFICACION.NEW_SPECIAL);
    expect(c.parent_product_id).toBeNull();
  });

  it('idéntico al padre = LINE_PRODUCT', () => {
    const intent = { materiales: [], caracteristicas: [], dimensiones: { ancho_mm: 1500 } };
    expect(clasificarProducto(intent, { parent: cirque }).clasificacion).toBe(CLASIFICACION.LINE_PRODUCT);
  });
});

describe('COCREAR · ProductSpec versionado', () => {
  it('cambiar la rev / contenido cambia el hash (versionado real)', () => {
    const intent = interpretarIntent(GOLDEN);
    const dna = extraerDNA(intent);
    const clasif = clasificarProducto(intent, { parent: null });
    const r1 = construirProductSpec(intent, dna, clasif, { rev: 1 });
    const r2 = construirProductSpec(intent, dna, clasif, { rev: 2 });
    expect(r1.hash).not.toBe(r2.hash);
    expect(r1.clasificacion).toBe(CLASIFICACION.NEW_SPECIAL);
  });
});

describe('COCREAR · costo honesto (VH-017, orquesta costear)', () => {
  const insumos = {
    tablero: { id: 'tablero', nombre: 'Tablero melamina', seccion: 'cubiertas', clase: 'directa', unidad: 'hoja', precio: 600, formato: { medida: 2.9768 }, fraccion: true, mermaCorte: 0 },
    luz: { id: 'luz', nombre: 'Tira LED', seccion: 'electrico', clase: 'indirecta', unidad: 'm', precio: null }, // SIN precio usable
  };
  const par = { aprovechamientoCorte: 80, margenObjetivo: 40, mermaProceso: 0, modeloCosteo: 'clasico' };
  const intent = interpretarIntent(GOLDEN);
  const dna = extraerDNA(intent);
  const clasif = clasificarProducto(intent, { parent: null });

  it('sin BOM ⇒ cost_status UNKNOWN, official_cost null (no finge costo)', () => {
    const spec = construirProductSpec(intent, dna, clasif, { rev: 1, componentes: [] });
    const snap = costearSpec(spec, insumos, par);
    expect(snap.cost_status).toBe(COST_STATUS.UNKNOWN);
    expect(snap.official_cost).toBeNull();
  });

  it('BOM con un insumo sin precio ⇒ PENDING_PRICE, official_cost null, known_cost > 0', () => {
    const spec = construirProductSpec(intent, dna, clasif, { rev: 2, componentes: [
      { nombre: 'Cubierta', insumoId: 'tablero', hojas: 1, piezas: 1, cantidad: 1 },
      { nombre: 'Tira LED', insumoId: 'luz', cantidad: 3, piezas: 1 },
    ] });
    const snap = costearSpec(spec, insumos, par);
    expect(snap.cost_status).toBe(COST_STATUS.PENDING_PRICE);
    expect(snap.official_cost).toBeNull();
    expect(snap.known_cost).toBeGreaterThan(0);
    // La línea de cotización NO se puede emitir: requiere desarrollo.
    expect(lineaCocreada(spec, snap).requiere_desarrollo).toBe(true);
  });

  it('BOM completo con precios reales ⇒ KNOWN, official_cost > 0, línea cotizable', () => {
    const insumos2 = { ...insumos, luz: { ...insumos.luz, precio: 120 } };
    const spec = construirProductSpec(intent, dna, clasif, { rev: 3, componentes: [
      { nombre: 'Cubierta', insumoId: 'tablero', hojas: 1, piezas: 1, cantidad: 1 },
      { nombre: 'Tira LED', insumoId: 'luz', cantidad: 3, piezas: 1 },
    ] });
    const snap = costearSpec(spec, insumos2, par);
    expect(snap.cost_status).toBe(COST_STATUS.KNOWN);
    expect(snap.official_cost).toBeGreaterThan(0);
    expect(lineaCocreada(spec, snap).listaParaCotizar).toBe(true);
  });
});

describe('COCREAR · manufacturabilidad honesta (§19 Smart Locker)', () => {
  it('Smart Locker eléctrico ⇒ REQUIRES_VALIDATION (la IA no lo vuelve PASS)', () => {
    const intent = interpretarIntent('Smart Locker de paquetería con cerraduras, controlador electrónico y ventilación, 1.80 m');
    const dna = extraerDNA(intent);
    const clasif = clasificarProducto(intent, { parent: null });
    const spec = construirProductSpec(intent, dna, clasif, { rev: 1 });
    const mfg = manufacturabilidad(spec);
    expect(mfg.estado).toBe(MFG_STATUS.REQUIRES_VALIDATION);
    expect(mfg.requisitos).toContain('controller');
    expect(mfg.requisitos).toContain('power');
    // Ingeniería también exige validación por las features eléctricas.
    expect(estadoIngenieria(spec).estado).toBe(ENG_STATUS.REQUIRES_VALIDATION);
  });
});

describe('COCREAR · orquestador end-to-end (Golden #1)', () => {
  it('recepción nueva sin BOM ⇒ pipeline corre, status BLOCKED (features requieren validación), nada fingido', () => {
    const r = cocrear(GOLDEN);
    // Todos los pasos existen en la historia.
    expect(r.historia.map((h) => h.paso)).toEqual([
      'intent', 'dna', 'clasificacion', 'product_spec', 'ingenieria', 'manufacturabilidad', 'costo', 'cotizacion',
    ]);
    expect(r.spec.clasificacion).toBe(CLASIFICACION.NEW_SPECIAL);
    // La iluminación integrada ⇒ ingeniería requiere validación ⇒ BLOCKED.
    expect(r.ingenieria.estado).toBe(ENG_STATUS.REQUIRES_VALIDATION);
    expect(r.status).toBe(COCREO_STATUS.BLOCKED);
    // El costo NO se finge: sin BOM es UNKNOWN y la línea requiere desarrollo.
    expect(r.costo.official_cost).toBeNull();
    expect(r.lineaCotizacion.requiere_desarrollo).toBe(true);
    expect(r.blockers.length).toBeGreaterThan(0);
  });

  it('un producto simple con BOM y precios reales ⇒ READY y cotizable', () => {
    const insumos = { tablero: { id: 'tablero', nombre: 'Tablero', seccion: 'cubiertas', clase: 'directa', unidad: 'hoja', precio: 600, formato: { medida: 2.9768 }, fraccion: true, mermaCorte: 0 } };
    const par = { aprovechamientoCorte: 80, margenObjetivo: 40, mermaProceso: 0, modeloCosteo: 'clasico' };
    const r = cocrear('Credenza 1.60 m laminado', { insumos, par, componentes: [{ nombre: 'Cuerpo', insumoId: 'tablero', hojas: 2, piezas: 1, cantidad: 1 }] });
    expect(r.manufacturabilidad.estado).toBe(MFG_STATUS.CAN_BUILD);
    expect(r.costo.official_cost).toBeGreaterThan(0);
    expect(r.status).toBe(COCREO_STATUS.READY);
    expect(r.lineaCotizacion.listaParaCotizar).toBe(true);
  });
});

describe('COCREAR · staleness (§22: cambia el spec ⇒ aguas abajo obsoleto)', () => {
  it('otra rev del mismo producto marca stale el resultado previo', () => {
    const r1 = cocrear('Credenza 1.60 m laminado', { componentes: [] });
    const intent = interpretarIntent('Credenza 1.80 m laminado'); // cambió la dimensión
    const spec2 = construirProductSpec(intent, extraerDNA(intent), clasificarProducto(intent, {}), { rev: 2 });
    expect(estaStale(r1, spec2)).toBe(true);
    expect(estaStale(r1, r1.spec)).toBe(false);
  });
});
