import { describe, it, expect } from 'vitest';
import { construirPdfExpediente } from './pdfExpedienteIndustrial.js';
import { expedienteIndustrialDesdeDespiece } from './expedienteIndustrialDesdeDespiece.js';

const insumos = { lam: { nombre: 'Lamina cal.18', seccion: 'metal' } };
const catalogoLamina = [{ id: 'lam18', calibre: 18, acero: 'negra', formato: { largoMM: 3050, anchoMM: 1220 }, precio: 571.54, certificable: true }];

describe('PDF del expediente industrial', () => {
  it('genera un PDF valido (%PDF, >0 bytes) desde un expediente real', () => {
    const exp = expedienteIndustrialDesdeDespiece(
      [{ clave: 'LAT#0', desc: 'Lateral', insumoId: 'lam', cantidad: 2, seccion: 'metal', largoMM: 700, anchoMM: 400 },
       { clave: 'CAJA#1', desc: 'Caja 3D', insumoId: 'lam', cantidad: 1, seccion: 'metal', fabricada: true }],
      { clave: 'PDF-TEST', insumosERP: insumos, catalogoLamina });
    const bytes = new Uint8Array(construirPdfExpediente(exp).output('arraybuffer'));
    expect(bytes.length).toBeGreaterThan(500);
    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe('%PDF-');
  });
  it('no truena con expediente vacio', () => {
    expect(() => construirPdfExpediente({})).not.toThrow();
  });
});
