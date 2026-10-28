// ============================================================================
//  PDF money trust contract (comportamiento, 2026-10-14).
//  Antes: buscaba `if (!Number.isFinite(v)) return '—'` en el TEXTO de pdfPropuesta.js e `importePorCantidad`
//  en FichaPDF.jsx. Ahora GENERA el PDF descargable (jsPDF en node) y lee lo que quedó dibujado en cada celda,
//  y ejecuta la escalera de montos que usa FichaPDF (datos/montosFicha.js).
// ============================================================================
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { propuestaPDF } from '../datos/pdfPropuesta.js';
import { montosFicha } from '../datos/montosFicha.js';
import { pesos2 } from '../util.js';

// Texto de cada operación `(...) Tj` del PDF sin comprimir. jsPDF/Helvetica codifica la raya "—" como \x97 (WinAnsi).
const textos = (doc) => (doc.output().match(/\((?:[^()\\]|\\.)*\) Tj/g) || []).map((t) => t.slice(1, -4));
const RAYA = '\x97';
const pdf = (partidas, totales = {}) => textos(propuestaPDF({
  cot: { folio: 'T-1', cliente: 'Cliente' }, partidas, resumen: [], especificacion: () => '', nPzas: partidas.length,
  totales: { precioLista: 0, ivaPct: 16, totalRedondeado: 0, ...totales },
}));
// Las dos celdas de dinero (P. UNITARIO, IMPORTE) del renglón `nombre`: van después de nombre y cantidad.
const celdas = (t, nombre) => { const i = t.indexOf(nombre); return [t[i + 2], t[i + 3]]; };

describe('PDF money trust contract', () => {
  it('FichaPDF usa fronteras monetarias canónicas y muestra centavos', () => {
    expect(montosFicha(1234.565, 3, 16)).toEqual({ importe: 3703.71, iva: 592.59, total: 4296.3 });
    // 0.1 × 3 en flotante = 0.30000000000000004: a centavos queda 0.30 exacto.
    expect(montosFicha(0.1, 3, 16).importe).toBe(0.3);
    expect(pesos2(montosFicha(1234.56, 1, 16).total)).toBe('$1,432.09');
    for (const [pu, q] of [['abc', 1], [NaN, 2], [null, 1], [100, 0], [100, -1]]) {
      const m = montosFicha(pu, q, 16);
      expect(m, `${pu}×${q}`).toEqual({ importe: null, iva: null, total: null });
      expect(pesos2(m.total)).not.toBe('$0.00');
    }
  });

  it('PDF descargable imprime centavos en cada renglón', () => {
    const t = pdf([{ nombre: 'Mesa ejecutiva', cantidad: 2, precioUnitario: 1234.56 }], { precioLista: 2469.12, iva: 395.06, totalRedondeado: 2864.18 });
    expect(celdas(t, 'Mesa ejecutiva')).toEqual(['$1,234.56', '$2,469.12']);
    expect(t).toContain('$395.06');
    expect(t).toContain('$2,864.18');
  });

  it('PDF descargable jamás convierte dinero inválido en $0.00', () => {
    const t = pdf([
      { nombre: 'Silla NaN', cantidad: 1, precioUnitario: NaN },
      { nombre: 'Silla texto', cantidad: 1, precioUnitario: 'abc' },
      { nombre: 'Silla infinita', cantidad: 2, precioUnitario: Infinity },
      { nombre: 'Silla sin precio', cantidad: 1, precioUnitario: null },
    ], { precioLista: NaN, iva: undefined, totalRedondeado: NaN });
    for (const n of ['Silla NaN', 'Silla texto', 'Silla infinita']) expect(celdas(t, n), n).toEqual([RAYA, RAYA]);
    expect(celdas(t, 'Silla sin precio')).toEqual(['Sin precio', 'Pendiente']);
    expect(t).not.toContain('$0.00');                       // ni en renglones ni en la escalera de totales
  });

  it('con un precio faltante el PDF etiqueta el TOTAL como INCOMPLETO (no lo presenta como definitivo)', () => {
    const t = pdf([
      { nombre: 'Mesa con precio', cantidad: 1, precioUnitario: 1000 },
      { nombre: 'Silla sin precio', cantidad: 1, precioUnitario: null },
    ], { precioLista: 1000, iva: 160, totalRedondeado: 1160, faltanPrecio: 1 });
    const j = t.join(' | ');
    expect(j).toContain('TOTAL INCOMPLETO');
    expect(j).toContain('faltan 1 precio');
    expect(j).toContain('Suma de renglones con precio');     // la suma dice que es sólo de renglones con precio
    expect(celdas(t, 'Silla sin precio')).toEqual(['Sin precio', 'Pendiente']);
  });

  it('una cotización completa conserva el TOTAL definitivo (sin "INCOMPLETO")', () => {
    const t = pdf([{ nombre: 'Mesa', cantidad: 1, precioUnitario: 1000 }], { precioLista: 1000, iva: 160, totalRedondeado: 1160, faltanPrecio: 0 });
    const j = t.join(' | ');
    expect(j).not.toContain('INCOMPLETO');
    expect(j).toContain('Suma de los renglones');
  });

  // STATIC GUARD: es la AUSENCIA de un cálculo muerto (costo total UNKNOWN→ZERO) que ya no existe en Cotizacion.jsx;
  // no hay comportamiento que ejecutar. Se conserva para que no reaparezca (la utilidad no se calcula en la pantalla de
  // cotización; la economía la decide el gate del servidor, probado en emissionExactCentsSql.test.js).
  it('Cotización no conserva cálculo muerto UNKNOWN→ZERO de costo total', () => {
    const cot = fs.readFileSync('src/componentes/Cotizacion.jsx', 'utf8');
    expect(cot).not.toContain('(p.costoUnitario || 0) * p.cantidad');
    expect(cot).not.toContain('const utilidadTotal = baseGravable - costoTotal');
  });

  // STATIC GUARD: FichaPDF.jsx no se monta en node (sin jsdom). Sólo el CABLEADO hacia la escalera probada.
  it('cableado: FichaPDF usa montosFicha y pesos2 (centavos), no el formateador al peso', () => {
    const ficha = fs.readFileSync('src/componentes/FichaPDF.jsx', 'utf8');
    expect(ficha).toContain('montosFicha(precioUnitario, cantidad, ivaPct)');
    expect(ficha).toContain('pesos2(');
    expect(ficha).not.toMatch(/\bpesos\(/);
  });
});
