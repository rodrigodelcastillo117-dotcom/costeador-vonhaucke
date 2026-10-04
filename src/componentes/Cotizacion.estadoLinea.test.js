// ============================================================================
//  Estado económico POR LÍNEA en Cotizar (seller-safe).
//  El gate server-side devuelve códigos como `linea_3_costo_desconocido`.
//  `razonesPorLinea` los reparte por renglón para el chip pegado a la partida,
//  y `textoRazonEmision` los traduce a lenguaje humano SIN cifras de costo/margen.
//  Mandato: "Integra los estados económicos reales en UX... Nunca unknown como $0".
// ============================================================================
import { describe, it, expect } from 'vitest';
import { razonesPorLinea, textoRazonEmision } from './Cotizacion.jsx';

describe('razonesPorLinea — reparte el gate por renglón', () => {
  it('sin gate → mapa vacío (no inventa estados)', () => {
    expect(razonesPorLinea(null).size).toBe(0);
    expect(razonesPorLinea(undefined).size).toBe(0);
    expect(razonesPorLinea({}).size).toBe(0);
  });

  it('agrupa motivos y economics por número de línea (1-based)', () => {
    const gate = {
      estado: 'BLOCKED',
      motivos: ['linea_1_sin_product_version_id'],
      economics: ['linea_3_costo_desconocido'],
    };
    const m = razonesPorLinea(gate);
    expect(m.has(1)).toBe(true);
    expect(m.has(3)).toBe(true);
    expect(m.has(2)).toBe(false);
    expect(m.get(1).tono).toBe('falta');
    expect(m.get(3).tono).toBe('falta');
  });

  it('aprobación eleva el tono de la línea a "aprob" aunque haya otro motivo', () => {
    const gate = {
      estado: 'APPROVAL_REQUIRED',
      economics: ['linea_2_margen_bajo', 'linea_2_costo_desconocido'],
    };
    const m = razonesPorLinea(gate);
    expect(m.get(2).tono).toBe('aprob');
    expect(m.get(2).textos.length).toBe(2);
  });

  it('códigos SIN número de línea no entran al mapa por-línea (van al banner general)', () => {
    const gate = { estado: 'BLOCKED', motivos: ['partidas_no_corresponden', 'sin_guardar'] };
    expect(razonesPorLinea(gate).size).toBe(0);
  });

  it('deduplica códigos repetidos entre motivos y economics', () => {
    const gate = {
      motivos: ['linea_1_costo_desconocido'],
      economics: ['linea_1_costo_desconocido'],
    };
    expect(razonesPorLinea(gate).get(1).textos.length).toBe(1);
  });
});

describe('textoRazonEmision — seller-safe, sin cifras', () => {
  it('traduce costo desconocido sin mencionar números', () => {
    const t = textoRazonEmision('linea_3_costo_desconocido');
    expect(t).toMatch(/Línea 3/);
    expect(t).toMatch(/confirmar el costo/i);
    expect(t).not.toMatch(/\$|\d+\s*%|margen|utilidad|proveedor/i);
  });

  it('versión de producto faltante guía a re-agregar desde la ficha', () => {
    expect(textoRazonEmision('linea_1_sin_product_version_id')).toMatch(/versión de producto/i);
  });

  it('margen/precio bajo => aprobación de Dirección (sin cifra)', () => {
    const t = textoRazonEmision('linea_2_margen_bajo');
    expect(t).toMatch(/aprobaci/i);
    expect(t).not.toMatch(/\$|\d+\s*%/);
  });

  it('producto_id_invalido => guía seller-safe a re-agregar (nunca código crudo)', () => {
    const t = textoRazonEmision('linea_1_producto_id_invalido');
    expect(t).toMatch(/Línea 1/);
    expect(t).toMatch(/re-agr[eé]gala|ficha/i);
    expect(t).not.toMatch(/producto_id_invalido/); // nunca el código crudo
    expect(t).not.toMatch(/\$|\d+\s*%|margen|proveedor/i);
  });

  it('costo_especial_desconocido => confirmar costo del especial (sin cifra)', () => {
    const t = textoRazonEmision('costo_especial_desconocido');
    expect(t).toMatch(/especial/i);
    expect(t).toMatch(/costo/i);
    expect(t).not.toMatch(/costo_especial_desconocido/);
  });

  it('código desconocido CON línea conserva el prefijo "Línea N:" (no se traga)', () => {
    const t = textoRazonEmision('linea_5_algo_nuevo');
    expect(t).toMatch(/^Línea 5:/);
    expect(t).toMatch(/algo_nuevo/); // crudo, pero con su línea
  });

  it('código desconocido degrada al propio texto, no truena', () => {
    expect(() => textoRazonEmision('algo_raro')).not.toThrow();
    expect(textoRazonEmision('algo_raro')).toBe('algo_raro');
    expect(textoRazonEmision('')).toBe('');
  });
});
