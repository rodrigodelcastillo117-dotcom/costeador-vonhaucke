import { describe, it, expect } from 'vitest';
import { decidirReemplazo, propuestaDegenerada } from './guardaPropuesta.js';

const P = (n, extra = {}) => ({ piezas: Array.from({ length: n }, (_, i) => ({ nombre: `Pieza ${i + 1}`, ...extra })) });

describe('VH-162 · ninguna pasada de la IA achica el BOM en silencio', () => {
  it('la verificación degenerada de la corrida V3 (12 → 1, piezas metidas en un texto) no reemplaza', () => {
    const degenerada = { piezas: [{ nombre: 'Cubierta superior', relacion_con: "','procedencia':'MEASURED','evidencia':'Vista frontal 1800','pagina':1},{'nombre':'Piso inferior'}" }] };
    expect(propuestaDegenerada(degenerada)).toBe(true);
    const d = decidirReemplazo(P(12), degenerada);
    expect(d.usar).toBe('vigente');
    expect(d.motivo).toMatch(/mal formada/);
  });
  it('12 → 4 sin señales de daño también se conserva (menos de la mitad)', () => {
    expect(decidirReemplazo(P(12), P(4)).usar).toBe('vigente');
  });
  it('12 → 11 o 12 → 14 sí reemplaza (ajustes normales de la verificación)', () => {
    expect(decidirReemplazo(P(12), P(11)).usar).toBe('nueva');
    expect(decidirReemplazo(P(12), P(14)).usar).toBe('nueva');
  });
  it('con pocas piezas vigentes (<4) no se bloquea un cambio legítimo; vacío nunca reemplaza', () => {
    expect(decidirReemplazo(P(3), P(1)).usar).toBe('nueva');
    expect(decidirReemplazo(P(5), { piezas: [] }).usar).toBe('vigente');
  });
  it('un texto normal con comas y dos puntos no se confunde con una pieza incrustada', () => {
    expect(propuestaDegenerada({ piezas: [{ nombre: 'Lateral', nota: 'cota 650: vista frontal, 2 piezas' }] })).toBe(false);
  });
});
