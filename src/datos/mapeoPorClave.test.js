// AUTO-SANADOR DE BOM — resolver clave ERP embebida → insumoId, fail-closed.
import { describe, it, expect } from 'vitest';
import { claveDeLinea, clavesDeInsumo, indicePorClave, resolverLinea, sanarBOM } from './mapeoPorClave.js';

// Catálogo-fixture con las formas reales de nombre del ERP.
const insumos = {
  'erp-tc181':     { nombre: 'TUBULAR INDUSTRIAL CUADRADO 1" CALIBRE 18 PIEZA DE 6000 mm - TC181', precio: 132.5, unidad: 'pza' },
  'erp-tu14he':    { nombre: 'TUERCA HEXAGONAL Ø1/4" GALVANIZADO -- TU14HE', precio: 0.22, unidad: 'pza' },
  'erp-mdf16':     { nombre: 'MDF NATURAL HOJA 4 X 8 ESPESOR 16 mm - MDF16', precio: 398.04, unidad: 'hoja' },
  // Dos variantes de MDF16M (color) → clave MDF16M AMBIGUA, no se auto-mapea.
  'erp-mdf16m-a':  { nombre: 'MDF MELAMINA DOS CARAS HOJA 4\' X 8\' ESPESOR 16 mm - "MDF16M" · ACABADO MADERA WALNUT', precio: 693.9, unidad: 'hoja' },
  'erp-mdf16m-b':  { nombre: 'MDF MELAMINA DOS CARAS HOJA 4\' X 8\' ESPESOR 16 mm - "MDF16M" · ACABADO MADERA BLACK', precio: 611, unidad: 'hoja' },
};

describe('auto-sanador · extracción de clave', () => {
  it('claveDeLinea lee la clave al final de la descripción', () => {
    expect(claveDeLinea('TUBULAR CUADRADO 1 CAL 18 6000mm - TC181')).toBe('TC181');
    expect(claveDeLinea('TUERCA HEXAGONAL 1/4 GALV - TU14HE')).toBe('TU14HE');
    expect(claveDeLinea('MDF NATURAL 4x8 16 mm - MDF16')).toBe('MDF16');
    expect(claveDeLinea('LAMINADO PLASTICO 4x8 - LP122244')).toBe('LP122244');
  });
  it('claveDeLinea NO inventa clave donde no la hay', () => {
    expect(claveDeLinea('Empaque jgo unitario basico')).toBe(null);
    expect(claveDeLinea('PIJA PHILLIPS 8x5/8 TABLAROCA')).toBe(null);     // 8x5/8 no es clave; no hay "- XXX"
    expect(claveDeLinea('TUERCA INSERTO 1/4 MADERA GALV')).toBe(null);
    expect(claveDeLinea('')).toBe(null);
  });
  it('clavesDeInsumo distingue MDF16 de MDF16M (no se contaminan)', () => {
    expect(clavesDeInsumo(insumos['erp-mdf16'].nombre)).toContain('MDF16');
    expect(clavesDeInsumo(insumos['erp-mdf16'].nombre)).not.toContain('MDF16M');
    expect(clavesDeInsumo(insumos['erp-mdf16m-a'].nombre)).toContain('MDF16M');
    expect(clavesDeInsumo(insumos['erp-mdf16m-a'].nombre)).not.toContain('MDF16');
  });
});

describe('auto-sanador · resolverLinea (fail-closed)', () => {
  const idx = indicePorClave(insumos);

  it('clave única + unidad compatible → mapea', () => {
    const r = resolverLinea({ desc: 'TUBULAR CUADRADO 1 CAL 18 6000mm - TC181' }, insumos, idx);
    expect(r.insumoId).toBe('erp-tc181');
  });
  it('MDF16 mapea a erp-mdf16 (no se confunde con MDF16M)', () => {
    const r = resolverLinea({ desc: 'MDF NATURAL 4x8 16 mm - MDF16', unidad: 'hoja' }, insumos, idx);
    expect(r.insumoId).toBe('erp-mdf16');
  });
  it('clave AMBIGUA (varias variantes) NO se mapea', () => {
    const r = resolverLinea({ desc: 'MDF MELAMINA 2 CARAS 16 mm - MDF16M', unidad: 'hoja' }, insumos, idx);
    expect(r.insumoId).toBe('');
    expect(r.motivo).toMatch(/variantes/i);
  });
  it('clave que no está en el catálogo NO se mapea', () => {
    const r = resolverLinea({ desc: 'LAMINA 3x8 c18 - LN1838' }, insumos, idx);
    expect(r.insumoId).toBe('');
    expect(r.motivo).toMatch(/no está en el catálogo/i);
  });
  it('sin clave en la descripción NO se mapea', () => {
    expect(resolverLinea({ desc: 'Empaque jgo unitario basico' }, insumos, idx).insumoId).toBe('');
  });
  it('unidad incompatible NO se mapea (no mete un bloqueo)', () => {
    const r = resolverLinea({ desc: '... - TC181', unidad: 'm2' }, insumos, idx);  // catálogo es pza
    expect(r.insumoId).toBe('');
    expect(r.motivo).toMatch(/unidad/i);
  });
  it('línea ya mapeada se preserva', () => {
    expect(resolverLinea({ desc: 'x', insumoId: 'ya' }, insumos, idx).insumoId).toBe('ya');
  });
});

describe('auto-sanador · sanarBOM (no destructivo, con reporte)', () => {
  it('mapea las claras, deja las ambiguas/sin-clave, y reporta', () => {
    const bom = { clave: 'T', lineas: [
      { desc: 'TUBULAR CUADRADO 1 CAL 18 6000mm - TC181' },             // → mapea
      { desc: 'TUERCA HEXAGONAL 1/4 GALV - TU14HE' },                   // → mapea
      { desc: 'MDF NATURAL 4x8 16 mm - MDF16', unidad: 'hoja' },        // → mapea
      { desc: 'MDF MELAMINA 2 CARAS 16 mm - MDF16M', unidad: 'hoja' },  // ambigua → no
      { desc: 'Empaque jgo unitario basico' },                         // sin clave → no
      { desc: 'lámina', insumoId: 'ya-tengo', precioConfirmado: 100 }, // ya mapeada → intacta
    ] };
    const { bom: sano, mapeadas, sinResolver } = sanarBOM(bom, insumos);
    expect(mapeadas.map((m) => m.insumoId).sort()).toEqual(['erp-mdf16', 'erp-tc181', 'erp-tu14he']);
    expect(sano.lineas[0].insumoId).toBe('erp-tc181');
    expect(sano.lineas[3].insumoId == null || sano.lineas[3].insumoId === undefined).toBe(true); // MDF16M sigue sin mapear
    expect(sano.lineas[5].insumoId).toBe('ya-tengo');                 // no toca las ya mapeadas
    expect(sinResolver.some((s) => s.clave === 'MDF16M')).toBe(true);
    // No muta el BOM original.
    expect(bom.lineas[0].insumoId).toBeUndefined();
  });
});
