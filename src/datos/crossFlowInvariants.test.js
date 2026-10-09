import { describe, it, expect } from 'vitest';
import { programaDelPlano } from './programaDelPlano.js';
import { observedProgramDeLectura } from './floorPlanReader.js';
import { resolverPrecioInsumoVivo } from './precioInsumoBridge.js';
import { firmaLayout } from './acomodoHash.js';
import { construirProductSpec } from './productSpec.js';
import { generarBOM } from './bomGenerator.js';

// ChatGPT §25 — UNA SOLA REALIDAD compartida. El MISMO hecho debe significar lo
// MISMO en todos los módulos. Estos invariantes protegen contra "cuatro apps
// escondidas en una UI": cualquier no-determinismo o inconsistencia rompe el RC.
const HOY = '2026-10-09';

describe('CROSS-FLOW INVARIANTS · una sola realidad (ChatGPT §25)', () => {
  it('mismo PLANO → mismos hechos observados (observed_program idéntico)', () => {
    const areas = [{ nombre: 'OP', ancho: 8, largo: 6 }, { nombre: 'JUNTAS', ancho: 5, largo: 4 }];
    const a = observedProgramDeLectura(programaDelPlano(areas));
    const b = observedProgramDeLectura(programaDelPlano(areas));
    expect(a).toEqual(b);
  });

  it('mismo INSUMO → misma resolución de precio/provenance (determinista)', () => {
    const ins = { precio: 544, unidad: 'hoja', nombre: 'Melamina', fuente: 'Compras, lista del 2026-08-14' };
    const a = resolverPrecioInsumoVivo('melamina-19', ins, { hoy: HOY });
    const b = resolverPrecioInsumoVivo('melamina-19', ins, { hoy: HOY });
    expect(a).toEqual(b);
    expect(a.estado).toBe(b.estado);
  });

  it('mismo LAYOUT → misma firma; layout distinto (1 mm) → firma distinta', () => {
    const plan = { colocacion: [{ id: 'p1', area: 0, x: 500, y: 500, rot: 0 }] };
    const movido = { colocacion: [{ id: 'p1', area: 0, x: 501, y: 500, rot: 0 }] };
    expect(firmaLayout(plan, 'pc', 'f')).toBe(firmaLayout(plan, 'pc', 'f'));
    expect(firmaLayout(movido, 'pc', 'f')).not.toBe(firmaLayout(plan, 'pc', 'f'));
  });

  it('mismo BOM (spec+reglas) → mismo costo/consumo (determinista)', () => {
    const spec = construirProductSpec({ partes: [{ part_id: 'cub', cantidad: 1, w: 1200, d: 600, material: 'melamina', espesor_mm: 19, procedencia: 'MEASURED' }] });
    const opts = { resolverMaterial: () => 'melamina-19', reglaMerma: () => 10 };
    expect(generarBOM(spec, opts)).toEqual(generarBOM(spec, opts));
  });

  it('CADENA: plano → observed_program → (confirmación requerida antes de costear)', () => {
    // Un observed_program recién leído SIEMPRE trae pendientes de confirmar
    // (sillas/gavetas sugeridas, muebles inferidos de cuartos): NUNCA se costea
    // como real sin confirmación humana. Invariante de "proposal ≠ confirmation".
    const areas = [{ nombre: 'OP', ancho: 8, largo: 6 }, { nombre: 'JUNTAS', ancho: 5, largo: 4 }];
    const items = observedProgramDeLectura(programaDelPlano(areas));
    const hayNoObservado = items.some((i) => i.origin !== 'observed');
    expect(hayNoObservado).toBe(true);   // hay inferidos/sugeridos → requieren confirmar
  });
});
