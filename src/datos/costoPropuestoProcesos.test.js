// Orquestador de costeo industrial: MP fisica real (motor) + MO POLITICA_VH + routing pendiente,
// fail-closed, preguntas agrupadas por decision, anti doble-conteo.
import { describe, it, expect, beforeEach } from 'vitest';
import { costearProductoIndustrial } from './costoPropuestoProcesos.js';
import { limpiarEstandares, cargarEstandar } from './costoOperacion.js';

const INSUMOS_ERP = {
  'erp-cap': { id: 'erp-cap', nombre: 'Capelo cristal', precio: 1737.99, unidad: 'pieza', seccion: 'cristal' },
};
const BOM = [
  { clave: 'P', desc: 'PUERTA EN LAMINA', cantidad: 2, dims_mm: [538, 794, 20], fabricada: true },
  { clave: 'CUE', desc: 'CUERPO EN LAMINA', cantidad: 1, dims_mm: [1200, 865, 600], fabricada: true },
  { clave: 'CAP', desc: 'CAPELO DE CRISTAL TEMPLADO', cantidad: 1, insumoId: 'erp-cap' },
  { clave: 'KIT', desc: 'KIT LED', cantidad: 1 },   // comprada sin precio
];
const ROUTING = { operaciones: [{ op: 'corte_lamina', centro: 'metalmecánica' }, { op: 'pintura', centro: 'pintura' }] };

describe('costearProductoIndustrial', () => {
  beforeEach(() => limpiarEstandares());

  it('MP fisica real + MO POLITICA_VH; routing pendiente; fail-closed; nunca certificable', () => {
    const r = costearProductoIndustrial({ piezasBOM: BOM, routing: ROUTING, insumosERP: INSUMOS_ERP });
    expect(r.certificable).toBe(false);
    // material: lamina fabricada (puertas) + comprado (capelo)
    expect(r.material.fabricado_lamina_mxn).toBeGreaterThan(0);
    expect(r.material.comprado_mxn).toBeGreaterThanOrEqual(1737.99 - 1);
    expect(r.material.piezas_fabricadas_costeadas).toBe(1);        // solo la puerta (cuerpo es 3D pendiente)
    // cuerpo 3D -> desarrollo pendiente; KIT -> comprada sin precio
    expect(r.cobertura.desarrollos_pendientes.map((d) => d.clave)).toContain('CUE');
    expect(r.cobertura.compradas_sin_precio.map((d) => d.clave)).toContain('KIT');
    expect(r.cobertura.cerrado).toBe(false);
    // MO POLITICA_VH presente; routing por tiempos aun no
    expect(r.mano_obra.politica_vh_mxn).toBeGreaterThan(0);
    expect(r.mano_obra.routing_tiempos_mxn).toBeNull();
    expect(r.mano_obra.routing_completa).toBe(false);
    // anti doble-conteo en la puerta
    expect(r.cobertura.doble_conteo.some((d) => d.clave === 'P')).toBe(true);
  });

  it('preguntas agrupadas por DECISION (no una por pieza)', () => {
    const r = costearProductoIndustrial({ piezasBOM: BOM, routing: ROUTING, insumosERP: INSUMOS_ERP });
    const decisiones = r.preguntas_por_decision.map((q) => q.decision);
    expect(decisiones).toContain('Confirmar espesores/calibres y desarrollos');
    expect(decisiones).toContain('Confirmar componentes comprados y su precio');
    expect(decisiones).toContain('Confirmar tiempos y tarifas por centro');
    // la decision de desarrollos agrupa puerta (calibre propuesto) + cuerpo (3D)
    const dev = r.preguntas_por_decision.find((q) => /espesores/.test(q.decision));
    expect(dev.afecta).toEqual(expect.arrayContaining(['P', 'CUE']));
    // operacion externa: cristal templado
    expect(decisiones).toContain('Confirmar operaciones externas (terceros)');
  });

  it('con estandares autorizados cargados, la MO por routing deja de ser null', () => {
    cargarEstandar({ centro: 'metalmecánica', op: 'corte_lamina', tiempo_proceso_min: 1, tarifa_mxn_min: 10, lote_piezas: 1, autorizado: true });
    cargarEstandar({ centro: 'pintura', op: 'pintura', tiempo_proceso_min: 2, tarifa_mxn_min: 10, lote_piezas: 1, autorizado: true });
    const r = costearProductoIndustrial({ piezasBOM: BOM, routing: ROUTING, insumosERP: INSUMOS_ERP });
    expect(r.mano_obra.routing_completa).toBe(true);
    expect(r.mano_obra.routing_tiempos_mxn).toBe(30);
  });
});
