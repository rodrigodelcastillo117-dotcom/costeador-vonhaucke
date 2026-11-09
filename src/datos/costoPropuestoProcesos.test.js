// Orquestador: MP autoritativa + MO POLITICA_VH + routing pendiente, total parcial vs oficial,
// emision comercial bloqueada en parcial, preguntas por decision.
import { describe, it, expect, beforeEach } from 'vitest';
import { costearProductoIndustrial } from './costoPropuestoProcesos.js';
import { limpiarEstandares, cargarEstandar, autoridadDesdeListas } from './costoOperacion.js';
const AUT = autoridadDesdeListas({ permitidos: [{ email: 'rodrigo@vh.mx', rol: 'direccion' }] });

const CAT = [
  { insumo_id: 'erp-ln22310', calibre: 22, acero: 'negra', formato: { largoMM: 3048, anchoMM: 914, area_m2: 2.786 }, precio: 326.59, precio_id: 8748, unidad: 'hoja', certificable: true, vigente_desde: '2026-01-26', estatus: 'CERTIFICADO', fuente: 'Compras · ERP Intelisis' },
  { insumo_id: 'erp-ln22410', calibre: 22, acero: 'negra', formato: { largoMM: 3048, anchoMM: 1219, area_m2: 3.716 }, precio: 521.55, precio_id: 13177, unidad: 'hoja', certificable: true, vigente_desde: '2026-10-20', estatus: 'CERTIFICADO', fuente: 'Compras · ERP Intelisis' },
];
const INSUMOS_ERP = { 'erp-cap': { id: 'erp-cap', nombre: 'Capelo cristal', precio: 1737.99, unidad: 'pieza', seccion: 'cristal' } };
const BOM = [
  { clave: 'P', desc: 'PUERTA EN LAMINA', cantidad: 2, dims_mm: [538, 794, 20], fabricada: true },     // panel inferido -> PRELIMINAR
  { clave: 'CUE', desc: 'CUERPO EN LAMINA', cantidad: 1, dims_mm: [1200, 865, 600], fabricada: true },  // caja 3D -> desarrollo pendiente
  { clave: 'CAP', desc: 'CAPELO DE CRISTAL TEMPLADO', cantidad: 1, insumoId: 'erp-cap' },
  { clave: 'KIT', desc: 'KIT LED', cantidad: 1 },
];
const ROUTING = { operaciones: [{ op: 'corte_lamina', centro: 'metalmecánica' }, { op: 'pintura', centro: 'pintura' }] };

describe('costearProductoIndustrial — total seguro (P1+P2)', () => {
  beforeEach(() => limpiarEstandares());

  it('MP autoritativa; material incluido vs pendiente; total parcial, NO emitible comercial', () => {
    const r = costearProductoIndustrial({ piezasBOM: BOM, routing: ROUTING, insumosERP: INSUMOS_ERP, catalogoLamina: CAT });
    // puerta costeada con lamina AUTORITATIVA (precio_id), no seed
    const puerta = r.material.evidencia.find((e) => e.clave === 'P');
    expect(puerta.lamina.precio_id).toBe(8748);
    expect(puerta.estado).toBe('PRELIMINAR');                 // desarrollo inferido + calibre propuesto
    // material incluido vs pendiente
    expect(r.material.pendiente.desarrollos_3d).toContain('CUE');
    expect(r.material.pendiente.compradas_sin_precio).toContain('KIT');
    expect(r.material.fabricado_preliminar_mxn).toBeGreaterThan(0);
    expect(r.material.fabricado_verificable_mxn).toBe(0);
    // total parcial, nunca oficial ni emitible
    expect(r.total.parcial_mxn).toBeGreaterThan(0);
    expect(r.total.oficial_mxn).toBeNull();
    expect(r.cobertura.cerrado).toBe(false);
    expect(r.emitible_comercial).toBe(false);
    // MO vigente presente; routing por tiempos pendiente
    expect(r.mano_obra.politica_vh_mxn).toBeGreaterThan(0);
    expect(r.mano_obra.routing_tiempos_mxn).toBeNull();
    // terceros (cristal templado)
    expect(r.terceros.pendiente).toBe(true);
  });

  it('aun con estandares de MO cargados, un total PARCIAL sigue sin ser emitible comercial', () => {
    cargarEstandar({ centro: 'metalmecánica', op: 'corte_lamina', tiempo_proceso_min: 1, tarifa_mxn_min: 10, lote_piezas: 1, version: 'v1', vigente_desde: '2026-01-01', aprobado_por: 'rodrigo@vh.mx' }, { autoridad: AUT });
    cargarEstandar({ centro: 'pintura', op: 'pintura', tiempo_proceso_min: 2, tarifa_mxn_min: 10, lote_piezas: 1, version: 'v1', vigente_desde: '2026-01-01', aprobado_por: 'rodrigo@vh.mx' }, { autoridad: AUT });
    const r = costearProductoIndustrial({ piezasBOM: BOM, routing: ROUTING, insumosERP: INSUMOS_ERP, catalogoLamina: CAT });
    expect(r.mano_obra.routing_completa).toBe(true);
    expect(r.emitible_comercial).toBe(false);                 // sigue faltando material (CUE 3D, KIT precio)
  });

  // --- P1 económico + P4 modelo oficial (auditoria 2caa5ee) ---
  const CERRADO = [{ clave: 'PL', desc: 'PLACA CALIBRE 22', cantidad: 1, dims_mm: [400, 230, 3], fabricada: true }]; // placa -> VERIFICABLE
  const R1 = { operaciones: [{ op: 'corte_lamina', centro: 'metalmecánica' }] };
  const AUTP = autoridadDesdeListas({ permitidos: [{ email: 'rodrigo@vh.mx', rol: 'direccion' }] });
  const POL_FACT = { modelo: 'factores_vh', aprobada_por: 'rodrigo@vh.mx' };
  const POL_ROUT = { modelo: 'routing_tiempos', aprobada_por: 'rodrigo@vh.mx' };
  const cargarR1 = () => cargarEstandar({ centro: 'metalmecánica', op: 'corte_lamina', tiempo_proceso_min: 1, tarifa_mxn_min: 10, lote_piezas: 1, version: 'v1', vigente_desde: '2026-01-01', aprobado_por: 'rodrigo@vh.mx' }, { autoridad: AUT });

  it('P4: SIN politica de costo aprobada -> oficial_mxn NULL aunque todo este completo', () => {
    cargarR1();
    const r = costearProductoIndustrial({ piezasBOM: CERRADO, routing: R1, catalogoLamina: CAT }); // sin politica
    expect(r.cobertura.cerrado).toBe(true);
    expect(r.total.oficial_mxn).toBeNull();
    expect(r.certificable).toBe(false);
    expect(r.total.bloqueado_por).toEqual(expect.arrayContaining([expect.stringMatching(/sin politica/)]));
  });

  it('P4: politica factores_vh aprobada + cerrado + sin terceros -> oficial = modelo factores (NO exige routing)', () => {
    const r = costearProductoIndustrial({ piezasBOM: CERRADO, routing: R1, catalogoLamina: CAT, politicaCosto: POL_FACT, autoridadPolitica: AUTP });
    expect(r.mano_obra.routing_completa).toBe(false);          // routing incompleto, pero la politica es factores
    expect(r.total.es_oficial).toBe(true);
    expect(r.total.modelo_oficial).toBe('factores_vh');
    expect(r.total.oficial_mxn).toBe(r.modelos.factores_vh_mxn);
    expect(r.certificable).toBe(true);                          // unificado
    expect(r.emitible_comercial).toBe(true);
  });

  it('P4: politica routing_tiempos aprobada exige routing completo; usa el total de routing (sin doble conteo)', () => {
    const sinMO = costearProductoIndustrial({ piezasBOM: CERRADO, routing: R1, catalogoLamina: CAT, politicaCosto: POL_ROUT, autoridadPolitica: AUTP });
    expect(sinMO.total.oficial_mxn).toBeNull();                 // falta MO routing
    expect(sinMO.total.bloqueado_por).toEqual(expect.arrayContaining([expect.stringMatching(/MO por routing/)]));
    cargarR1();
    const conMO = costearProductoIndustrial({ piezasBOM: CERRADO, routing: R1, catalogoLamina: CAT, politicaCosto: POL_ROUT, autoridadPolitica: AUTP });
    expect(conMO.total.es_oficial).toBe(true);
    expect(conMO.total.modelo_oficial).toBe('routing_tiempos');
    expect(conMO.total.oficial_mxn).toBe(conMO.modelos.routing_tiempos_mxn);
    // los dos modelos son SEPARADOS y el total de routing != el de factores (distinta MO)
    expect(conMO.modelos.routing_tiempos_mxn).not.toBe(conMO.modelos.factores_vh_mxn);
  });

  it('P4: politica con aprobador no autorizado -> no aprobada -> oficial NULL', () => {
    cargarR1();
    const r = costearProductoIndustrial({ piezasBOM: CERRADO, routing: R1, catalogoLamina: CAT, politicaCosto: { modelo: 'factores_vh', aprobada_por: 'vendedor@vh.mx' }, autoridadPolitica: AUTP });
    expect(r.politica_costo.aprobada).toBe(false);
    expect(r.total.oficial_mxn).toBeNull();
  });

  it('P1: terceros pendientes -> oficial_mxn NULL aun con politica y MO completa', () => {
    cargarR1();
    const bom = [...CERRADO, { clave: 'CR', desc: 'CRISTAL TEMPLADO', cantidad: 1, insumoId: 'erp-cr' }];
    const r = costearProductoIndustrial({ piezasBOM: bom, routing: R1, catalogoLamina: CAT, insumosERP: { 'erp-cr': { id: 'erp-cr', precio: 100, unidad: 'pieza', seccion: 'cristal' } }, politicaCosto: POL_ROUT, autoridadPolitica: AUTP });
    expect(r.terceros.pendiente).toBe(true);
    expect(r.total.oficial_mxn).toBeNull();
    expect(r.total.bloqueado_por).toEqual(expect.arrayContaining([expect.stringMatching(/terceros/)]));
  });

  it('preguntas agrupadas por DECISION', () => {
    const r = costearProductoIndustrial({ piezasBOM: BOM, routing: ROUTING, insumosERP: INSUMOS_ERP, catalogoLamina: CAT });
    const dec = r.preguntas_por_decision.map((q) => q.decision);
    expect(dec).toContain('Confirmar espesores/calibres y desarrollos');
    expect(dec).toContain('Confirmar componentes comprados y su precio');
    expect(dec).toContain('Confirmar tiempos y tarifas por centro');
  });
});
