import { describe, it, expect } from 'vitest';
import { renglonPrevio, despiecePrevioTexto } from './requestPlan.js';

// Certificación 18-oct: "- 2x Marcos … lineal 2800x0" se leía como 2.8 m en total y la IA "corregía" el tubo de la
// mesa de centro a 4.4–5.2 m (el plano dice 7.17 m). El renglón debe decir sin ambigüedad piezas, medida y total.
describe('despiece previo para la pasada de revisión', () => {
  it('lineal: 2 piezas × 2800 mm = 5.6 m en total', () => {
    const t = renglonPrevio({ nombre: 'Marcos rectangulares base', insumoId: 'tubular-redondo-34', forma: 'lineal', largoMM: 2800, cantidad: 2, confianza: 'alta' });
    expect(t).toBe('- Marcos rectangulares base [tubular-redondo-34] LINEAL: 2 pieza(s) × 2800 mm c/u = 5.6 m en total (largoMM=2800, cantidad=2, metrosTotales=5.6) (alta)');
    expect(t).not.toMatch(/2800x0/);
  });
  it('postes: 4 × 392 mm = 1.568 m; con los marcos suma los 7.17 m del plano', () => {
    const t = despiecePrevioTexto([
      { nombre: 'Marcos', forma: 'lineal', largoMM: 2800, cantidad: 2 },
      { nombre: 'Postes', forma: 'lineal', largoMM: 392, cantidad: 4 },
    ]);
    expect(t).toMatch(/= 5\.6 m en total/); expect(t).toMatch(/= 1\.568 m en total/);
  });
  it('área: piezas, medida y m²; pieza: sólo piezas', () => {
    expect(renglonPrevio({ nombre: 'Cubierta', insumoId: 'cristal-templado', forma: 'area', largoMM: 1000, anchoMM: 600, cantidad: 1 }))
      .toBe('- Cubierta [cristal-templado] ÁREA: 1 pieza(s) de 1000 × 600 mm = 0.6 m² en total (cantidad=1)');
    expect(renglonPrevio({ nombre: 'Niveladores', insumoId: 'nivelador', forma: 'pieza', cantidad: 4 })).toBe('- Niveladores [nivelador] PIEZA: 4 pieza(s)');
  });
  it('sin material y sin largo no revienta', () => {
    expect(renglonPrevio({ nombre: 'Soldadura', forma: 'lineal', cantidad: 1 })).toBe('- Soldadura [SIN MATERIAL] LINEAL: 1 m en total (sin largo por pieza)');
    expect(despiecePrevioTexto(null)).toBe('');
  });
});
