// ============================================================================
//  Guardrail #3 (exclusiones): el PDF debe poder imprimir la cláusula de piezas
//  NO incluidas (las provee el cliente) sin romperse. Regresión mínima del camino.
// ============================================================================
import { describe, it, expect } from 'vitest';
import { propuestaPDF } from './pdfPropuesta.js';

const base = {
  cot: { folio: 'TEST-1', cliente: 'Cliente X' },
  partidas: [{ nombre: 'Mesa', cantidad: 1, precioUnitario: 1000 }],
  resumen: [], especificacion: () => '', nPzas: 1,
  totales: { precioLista: 1000, total: 1160, totalRedondeado: 1160 },
};

describe('PDF — cláusula de exclusiones', () => {
  it('renderiza con exclusionesBOM sin romper', () => {
    const doc = propuestaPDF({ ...base, exclusionesBOM: ['Cristal templado 10mm', 'Herrajes estructurales'] });
    expect(doc).toBeTruthy();
    expect(typeof doc.save).toBe('function');
  });
  it('renderiza igual sin exclusiones (retrocompatible)', () => {
    const doc = propuestaPDF({ ...base });
    expect(doc).toBeTruthy();
  });
});
