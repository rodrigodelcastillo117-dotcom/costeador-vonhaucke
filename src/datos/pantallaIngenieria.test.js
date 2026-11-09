// Pantalla de Ingenieria: view-model de 5 secciones sobre el expediente existente.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { vistaIngenieria, mejorasDe, aplicarConfirmacion, recostearExpediente } from './pantallaIngenieria.js';
import { limpiarEstandares } from './costoOperacion.js';

const EXP = JSON.parse(readFileSync(new URL('../../expedientes/EXPEDIENTE_TELSVH120.json', import.meta.url), 'utf8'));

describe('pantallaIngenieria', () => {
  it('vistaIngenieria arma las 5 secciones desde el expediente real', () => {
    const v = vistaIngenieria(EXP);
    expect(v.clave).toBe('TELSVH120');
    // ESTO ENTENDI
    expect(v.esto_entendi.producto).toMatch(/vitrina/i);
    expect(v.esto_entendi.dimensiones_mm).toEqual({ ancho: 1200, alto: 1150, fondo: 600 });
    expect(v.esto_entendi.modulos.length).toBeGreaterThan(0);
    // ASI LO FABRICARIA
    expect(v.asi_lo_fabricaria.piezas_fabricadas.length).toBeGreaterThan(0);
    expect(v.asi_lo_fabricaria.desarrollos_pendientes.length).toBeGreaterThan(0);  // cajas 3D
    // CONFIRMAR (agrupado por decision)
    expect(v.esto_necesito_confirmar.length).toBeGreaterThan(0);
    expect(v.esto_necesito_confirmar.every((d) => d.decision && Array.isArray(d.afecta))).toBe(true);
    // COSTO
    expect(v.este_es_el_costo.material_incluido).toBeGreaterThan(0);
    expect(v.este_es_el_costo.total_parcial).toBeGreaterThan(0);
    expect(v.este_es_el_costo.certificable).toBe(false);
    expect(v.este_es_el_costo.emitible_comercial).toBe(false);
    expect(v.este_es_el_costo.estado).toMatch(/PARCIAL|OFICIAL/);
    // MEJORAS
    expect(Array.isArray(v.asi_podria_mejorarse)).toBe(true);
  });

  it('mejorasDe propone nesteo conjunto cuando varias piezas comparten lamina', () => {
    const costo = { material: { evidencia: [
      { clave: 'A', lamina: { id: 'lamina-22' }, aprovechamiento_pct: 60 },
      { clave: 'B', lamina: { id: 'lamina-22' }, aprovechamiento_pct: 90 },
    ] }, cobertura: { compradas_sin_precio: [{ clave: 'KIT' }] } };
    const m = mejorasDe(costo);
    expect(m.some((x) => x.tipo === 'nesteo_conjunto')).toBe(true);
    expect(m.some((x) => x.tipo === 'aprovechamiento' && x.clave === 'A')).toBe(true);
    expect(m.some((x) => x.tipo === 'make_vs_buy')).toBe(true);
  });

  it('P3 recostearExpediente: confirmar desarrollo de CAD recalcula, versiona y saca la pieza de pendientes', () => {
    limpiarEstandares();
    expect(EXP.inputs).toBeTruthy();                                   // el expediente lleva inputs para recalcular
    const antesMat = EXP.costo_industrial.material.total_mxn;
    const v2 = recostearExpediente(EXP, { tipo: 'desarrollo', clave: 'TELSVH120-CUE', desarrollo_mm: [2770, 865] });
    expect(v2.version).toBe((EXP.version || 1) + 1);                   // versiona
    expect(v2.costo_industrial.material.pendiente.desarrollos_3d).not.toContain('TELSVH120-CUE');
    expect(v2.costo_industrial.material.total_mxn).toBeGreaterThan(antesMat);  // el cuerpo entra al material
    expect(v2.confirmaciones.at(-1).tipo).toBe('desarrollo');          // conserva la traza
    expect(EXP.version || 1).toBe(1);                                  // no muta el original
  });

  it('P3 recostearExpediente: cargar estandares de MO hace que la MO por routing deje de ser null', () => {
    limpiarEstandares();
    const centros = [...new Set((EXP.inputs.routing.operaciones || []).map((o) => o.centro))];
    const estandares = centros.map((c) => ({ centro: c, op: (EXP.inputs.routing.operaciones.find((o) => o.centro === c) || {}).op, tiempo_proceso_min: 2, tarifa_mxn_min: 8, lote_piezas: 1, version: 'v1', vigente_desde: '2026-01-01', autorizado: true }));
    // cargar TODOS los op de cada centro
    const ops = EXP.inputs.routing.operaciones.map((o) => ({ centro: o.centro, op: o.op, tiempo_proceso_min: 2, tarifa_mxn_min: 8, lote_piezas: 1, version: 'v1', vigente_desde: '2026-01-01', autorizado: true }));
    const v2 = recostearExpediente(EXP, { tipo: 'estandares', estandares: ops });
    expect(v2.costo_industrial.mano_obra.routing_completa).toBe(true);
    expect(v2.costo_industrial.mano_obra.routing_tiempos_mxn).toBeGreaterThan(0);
  });

  it('recostearExpediente sin inputs lanza (no recalcula a ciegas)', () => {
    expect(() => recostearExpediente({ clave: 'X' }, { tipo: 'calibre', clave: 'Y', calibre: 22 })).toThrow(/sin inputs/);
  });

  it('aplicarConfirmacion registra la decision sin perder informacion y mueve pendientes', () => {
    const v = aplicarConfirmacion(EXP, { decision: 'Confirmar tiempos y tarifas por centro', respuesta: 'Ingenieria cargara estandares v1' });
    expect(v.confirmaciones['Confirmar tiempos y tarifas por centro'].respuesta).toMatch(/estandares/);
    expect(v.pendientes_resueltas).toContain('Confirmar tiempos y tarifas por centro');
    // no pierde el expediente original
    expect(v.clave).toBe('TELSVH120');
    expect(v.costo_industrial).toBeTruthy();
    // las demas decisiones siguen abiertas
    expect(v.pendientes_abiertas.length).toBeGreaterThan(0);
  });
});
