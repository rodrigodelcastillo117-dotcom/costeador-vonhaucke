// Pantalla de Ingenieria: view-model de 5 secciones sobre el expediente existente.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { vistaIngenieria, mejorasDe, aplicarConfirmacion } from './pantallaIngenieria.js';

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
    expect(v.este_es_el_costo.material_total).toBeGreaterThan(0);
    expect(v.este_es_el_costo.costo_fabricacion_vh).toBeGreaterThan(0);
    expect(v.este_es_el_costo.certificable).toBe(false);
    expect(v.este_es_el_costo.estado).toMatch(/PARCIAL|COMPLETO/);
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
