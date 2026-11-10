// ============================================================================
//  CONTRATO DE INTEGRIDAD · despiece confirmado → Producto Maestro (P0 2026-11-09).
//  RED→GREEN: cada caso prueba un defecto que el flujo anterior permitía:
//   · descartaba en silencio líneas sin SKU/precio (pérdida de piezas),
//   · etiquetaba SIEMPRE BOM_DETALLADO_VERIFICADO (incompleto = "verificado"),
//   · cantidad = costo/precio y unidad '' (sin trazabilidad física),
//   · cos_fab_real = multiplicación de factores (calculado disfrazado de medido).
// ============================================================================
import { describe, it, expect } from 'vitest';
import { bomDesdeDespiece, listoParaGuardar, puedeVerificarse } from './productoMaestroDesdeDespiece.js';
import { costearBOM } from './productoMaestro.js';

// Catálogo vigente de prueba (precio fresco/certificable).
const insumos = {
  lam: { nombre: 'Lamina cal.18', seccion: 'metal', unidad: 'hoja', unidad_compra: 'hoja', precio: 800, evidencia: { certificable: true } },
  pin: { nombre: 'Pintura en polvo', seccion: 'acabados', unidad: 'kg', precio: 150, evidencia: { certificable: true } },
  tor: { nombre: 'Tornilleria', seccion: 'herrajes', unidad: 'pza', precio: 2, evidencia: { certificable: true } },
};
// Línea del motor con cantidad FÍSICA real (unidades/comprado) y costo = precio × física.
const linea = (insumoId, precio, fisica, campo = 'unidades', extra = {}) => ({
  insumoId, precio, costo: +(precio * fisica).toFixed(6), [campo]: fisica,
  unidad: (insumos[insumoId] || {}).unidad, metodoConsumo: 'RENDIMIENTO_GEOMETRICO', ...extra,
});

const FACT = { factorMo: 0.1, factorGif: 0.25 };

describe('P0 · nada desaparece: las piezas sin identidad se CONSERVAN como pendientes', () => {
  it('BOM 10 líneas, 2 sin SKU → 10 líneas guardadas (8 costeables + 2 pendientes), NO verificado', () => {
    const detalle = [
      ...Array.from({ length: 8 }, (_, i) => linea('lam', 800, 1 + i * 0.1)),
      { insumoId: null, desc: 'Refuerzo interno sin identificar', precio: 0, costo: 0 },
      { insumoId: '', desc: 'Omega sin SKU', precio: 0, costo: 0 },
    ];
    const bom = bomDesdeDespiece(detalle, insumos, { clave: 'nuevo-10', verificar: true, ...FACT });
    expect(bom.lineas.length).toBe(10);                 // nada se descarta
    expect(bom.pendientes.length).toBe(2);
    expect(bom.tipo_bom).toBe('BOM_BORRADOR');          // 2 pendientes ⇒ NO verificado aunque se pida verificar
    expect(bom.integridad.completo).toBe(false);
    expect(puedeVerificarse(bom)).toBe(false);
    // las pendientes siguen nombradas, no en un $0 anónimo
    expect(bom.pendientes.map((p) => p.desc)).toEqual(
      expect.arrayContaining(['Refuerzo interno sin identificar', 'Omega sin SKU'])
    );
  });

  it('al recostear, un BOM con pendiente NO es emitible ni certificable (la pieza faltante bloquea)', () => {
    const detalle = [linea('lam', 800, 2.5), { insumoId: null, desc: 'Pieza oculta', precio: 0, costo: 0 }];
    const bom = bomDesdeDespiece(detalle, insumos, { clave: 'x', verificar: true, ...FACT });
    const r = costearBOM(bom, insumos);
    expect(r.emitible).toBe(false);                     // la pendiente bloquea
    expect(r.certificable).toBe(false);
    expect(r.bloqueos.length).toBeGreaterThan(0);
  });
});

describe('P0 · incompleto ≠ verificado (Dirección guardando un borrador incompleto)', () => {
  it('material oculto sin precio → pendiente, NO verificado', () => {
    const detalle = [linea('lam', 800, 2.5), { insumoId: 'tor', precio: 0, costo: 0, unidades: 50, unidad: 'pza' }];
    const bom = bomDesdeDespiece(detalle, insumos, { clave: 'y', verificar: true, ...FACT });
    expect(bom.tipo_bom).toBe('BOM_BORRADOR');
    expect(bom.pendientes.length).toBe(1);
    expect(bom.pendientes[0].motivo).toMatch(/precio/i);
  });

  it('listoParaGuardar: se puede guardar como BORRADOR, pero NUNCA como verificado con pendientes', () => {
    const detalle = [linea('lam', 800, 2.5), { insumoId: null, desc: 'pend', precio: 0, costo: 0 }];
    const borrador = bomDesdeDespiece(detalle, insumos, { clave: 'z', verificar: true, ...FACT });
    const v = listoParaGuardar(borrador);
    expect(v.ok).toBe(true);                            // el borrador SÍ se guarda (preservando la pendiente)
    expect(v.estado).toBe('borrador');
    expect(v.aviso).toMatch(/pendiente/i);
    // y si alguien forja tipo_bom VERIFICADO con una pendiente, se rechaza
    const forjado = { ...borrador, tipo_bom: 'BOM_DETALLADO_VERIFICADO' };
    expect(listoParaGuardar(forjado).ok).toBe(false);
  });
});

describe('P0 · la cantidad es FÍSICA, no un artefacto de costo/precio', () => {
  it('cantidad viene de la física del motor y conserva la unidad; costo/precio sólo reconcilia', () => {
    const bom = bomDesdeDespiece([linea('lam', 800, 2.5)], insumos, { clave: 'u', verificar: true, ...FACT });
    const l = bom.lineas[0];
    expect(l.unidad).toBe('hoja');                      // ya NO es ''
    expect(l.cantidad).toBeCloseTo(2.5, 6);
    expect(l.fisica.valor).toBeCloseTo(2.5, 6);         // tomada de unidades
    expect(l.cantidad_costo).toBeCloseTo(2.5, 6);       // comprobación costo/precio
    expect(l.reconcilia).toBe(true);
    expect(l.procedencia).toBe('MEASURED');
  });

  it('sin cantidad física (sólo importe) → no trazable → no se puede verificar', () => {
    const soloImporte = [{ insumoId: 'lam', precio: 800, costo: 2000 }]; // sin unidades/comprado/neto
    const bom = bomDesdeDespiece(soloImporte, insumos, { clave: 'w', verificar: true, ...FACT });
    expect(bom.tipo_bom).toBe('BOM_BORRADOR');
    expect(bom.integridad.todasTrazables).toBe(false);
    expect(bom.no_verificable_por.join(' ')).toMatch(/trazable|física/i);
  });
});

describe('P0 · calculado ≠ medido', () => {
  it('cos_fab_calculado sale de factores; cos_fab_real es null salvo referencia medida', () => {
    const bom = bomDesdeDespiece([linea('lam', 800, 2.5)], insumos, { clave: 'c', verificar: true, ...FACT });
    expect(bom.cos_fab_calculado).toBeCloseTo(2000 * (1 + 0.1 + 0.25), 2);
    expect(bom.cos_fab_real).toBeNull();
    const conRef = bomDesdeDespiece([linea('lam', 800, 2.5)], insumos, { clave: 'c', verificar: true, cos_fab_real_medido: 2900, ...FACT });
    expect(conRef.cos_fab_real).toBe(2900);
  });
});

describe('camino feliz · BOM completo y trazable → VERIFICADO + round-trip exacto', () => {
  const detalle = [linea('lam', 800, 2.5), linea('pin', 150, 3, 'comprado')];
  it('verificar:true con todo mapeado y trazable → BOM_DETALLADO_VERIFICADO certificable', () => {
    const bom = bomDesdeDespiece(detalle, insumos, { clave: 'ok-1', verificar: true, ...FACT });
    expect(bom.tipo_bom).toBe('BOM_DETALLADO_VERIFICADO');
    expect(puedeVerificarse(bom)).toBe(true);
    const r = costearBOM(bom, insumos);
    expect(r.material).toBeCloseTo(2450, 2);
    expect(r.emitible).toBe(true);
    expect(r.orientativo).toBe(false);
    expect(r.certificable).toBe(true);
  });

  it('sin verificar explícito → BORRADOR aunque esté completo (verificar es un acto deliberado)', () => {
    const bom = bomDesdeDespiece(detalle, insumos, { clave: 'ok-1', ...FACT });
    expect(bom.tipo_bom).toBe('BOM_BORRADOR');
    expect(puedeVerificarse(bom)).toBe(true);           // elegible, pero no promovido
  });

  it('si el precio del catálogo cambia, el costo flota con la cantidad física fija', () => {
    const bom = bomDesdeDespiece(detalle, insumos, { clave: 'ok-1', verificar: true, ...FACT });
    const nuevos = { ...insumos, lam: { ...insumos.lam, precio: 900 } };
    expect(costearBOM(bom, nuevos).material).toBeCloseTo(2700, 2); // 2.5*900 + 450
  });

  it('precio histórico (insumo fuera del catálogo al recostear) → orientativo, NO certificable', () => {
    const bom = bomDesdeDespiece(detalle, insumos, { clave: 'ok-1', verificar: true, ...FACT });
    const r = costearBOM(bom, { pin: insumos.pin }); // 'lam' ya no está en catálogo → usa precioConfirmado
    expect(r.orientativo).toBe(true);
    expect(r.certificable).toBe(false);
  });
});

describe('FAIL-CLOSED TERCEROS (bloqueo 1): un subcontratado sin clasificar NO se cuesta x1.80 en silencio', () => {
  const insumosT = {
    ...insumos,
    cri: { nombre: 'Cristal templado 6mm', seccion: 'cristal', unidad: 'pza', precio: 700, evidencia: { certificable: true } },
    gal: { nombre: 'Lamina galvanizada corte laser', seccion: 'metal', unidad: 'hoja', precio: 900, evidencia: { certificable: true } },
  };
  it('cristal TEMPLADO -> catalogo lo resuelve compra_venta (VH no templa vidrio), NO bloquea', () => {
    const detalle = [linea('lam', 800, 2), linea('cri', 700, 4)];
    const bom = bomDesdeDespiece(detalle, insumosT, { clave: 'con-cristal', verificar: true, ...FACT });
    const cristal = bom.lineas.find((l) => /Cristal/.test(l.desc));
    expect(cristal.pendiente).toBeFalsy();
    expect(cristal.esCompraVenta).toBe(true);                // vidrio templado -> x1.06
    expect(cristal.clasificacion_fuente).toBe('catalogo_vh_draft');
  });
  it('tercero AMBIGUO (galvanizado/corte laser) NO tiene regla -> BLOQUEADO (Compras decide)', () => {
    const detalle = [linea('lam', 800, 2), linea('gal', 900, 1, 'unidades')];
    const bom = bomDesdeDespiece(detalle, insumosT, { clave: 'con-galv', verificar: true, ...FACT });
    const galv = bom.lineas.find((l) => /galvaniz/i.test(l.desc));
    expect(galv.pendiente).toBe(true);                      // ambiguo: puede ser proceso propio
    expect(galv.requiereClasificacionTercero).toBe(true);
    const r = costearBOM(bom, insumosT);
    expect(r.emitible).toBe(false);                          // bloquea hasta decision de Ingenieria/Compras
  });

  it('cristal declarado compra_venta por Ingenieria -> fluye como x1.06 y desbloquea', () => {
    const detalle = [linea('lam', 800, 2), linea('cri', 700, 4, 'unidades', { clasificacionTercero: 'compra_venta' })];
    const bom = bomDesdeDespiece(detalle, insumosT, { clave: 'cristal-cv', verificar: true, ...FACT });
    const cristal = bom.lineas.find((l) => /Cristal/.test(l.desc));
    expect(cristal.pendiente).toBeFalsy();
    expect(cristal.esCompraVenta).toBe(true);               // comprado terminado -> x1.06
    expect(bom.integridad.completo).toBe(true);
  });

  it('cristal declarado fabricado (se hace en casa) -> x1.80 explicito, sin bloqueo', () => {
    const detalle = [linea('cri', 700, 4, 'unidades', { clasificacionTercero: 'fabricado' })];
    const bom = bomDesdeDespiece(detalle, insumosT, { clave: 'cristal-fab', verificar: true, ...FACT });
    const cristal = bom.lineas.find((l) => /Cristal/.test(l.desc));
    expect(cristal.pendiente).toBeFalsy();
    expect(cristal.esCompraVenta).toBe(false);              // fabricado declarado -> x1.80, sin ambiguedad
  });
});
