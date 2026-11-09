// Orquestador: MP autoritativa + MO POLITICA_VH + routing pendiente, total parcial vs oficial,
// emision comercial bloqueada en parcial, preguntas por decision.
import { describe, it, expect, beforeEach } from 'vitest';
import { costearProductoIndustrial } from './costoPropuestoProcesos.js';
import { limpiarEstandares, cargarEstandar } from './costoOperacion.js';

const CAT = [
  { insumo_id: 'erp-ln22310', calibre: 22, formato: { largoMM: 3048, anchoMM: 914, area_m2: 2.786 }, precio: 326.59, precio_id: 8748, unidad: 'hoja', certificable: true, vigente_desde: '2026-01-26', estatus: 'CERTIFICADO', fuente: 'Compras · ERP Intelisis' },
  { insumo_id: 'erp-ln22410', calibre: 22, formato: { largoMM: 3048, anchoMM: 1219, area_m2: 3.716 }, precio: 521.55, precio_id: 13177, unidad: 'hoja', certificable: true, vigente_desde: '2026-10-20', estatus: 'CERTIFICADO', fuente: 'Compras · ERP Intelisis' },
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
    cargarEstandar({ centro: 'metalmecánica', op: 'corte_lamina', tiempo_proceso_min: 1, tarifa_mxn_min: 10, lote_piezas: 1, autorizado: true });
    cargarEstandar({ centro: 'pintura', op: 'pintura', tiempo_proceso_min: 2, tarifa_mxn_min: 10, lote_piezas: 1, autorizado: true });
    const r = costearProductoIndustrial({ piezasBOM: BOM, routing: ROUTING, insumosERP: INSUMOS_ERP, catalogoLamina: CAT });
    expect(r.mano_obra.routing_completa).toBe(true);
    expect(r.emitible_comercial).toBe(false);                 // sigue faltando material (CUE 3D, KIT precio)
  });

  it('preguntas agrupadas por DECISION', () => {
    const r = costearProductoIndustrial({ piezasBOM: BOM, routing: ROUTING, insumosERP: INSUMOS_ERP, catalogoLamina: CAT });
    const dec = r.preguntas_por_decision.map((q) => q.decision);
    expect(dec).toContain('Confirmar espesores/calibres y desarrollos');
    expect(dec).toContain('Confirmar componentes comprados y su precio');
    expect(dec).toContain('Confirmar tiempos y tarifas por centro');
  });
});
