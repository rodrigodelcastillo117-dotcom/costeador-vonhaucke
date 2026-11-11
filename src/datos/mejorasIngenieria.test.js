// mejorasDe leía campos inexistentes (e.lamina.id, e.calibre_fuente) → las sugerencias de nesteo
// conjunto y de estandarizar calibre NUNCA disparaban, y la de aprovechamiento mostraba "undefined".
// Este test fija la forma REAL de la evidencia y exige que las tres se generen correctamente.
import { describe, it, expect } from 'vitest';
import { mejorasDe } from './pantallaIngenieria.js';

const costo = {
  material: {
    evidencia: [
      { clave: 'A', lamina: { insumo_id: 'ln22' }, calibre: { fuente: 'propuesto (override)' }, aprovechamiento_pct: 50 },
      { clave: 'B', lamina: { insumo_id: 'ln22' }, calibre: { fuente: 'del plano' } },
    ],
  },
};

describe('mejorasDe · sugerencias de ingeniería disparan con la forma real de la evidencia', () => {
  const m = mejorasDe(costo);
  const tipos = m.map((x) => x.tipo);

  it('nesteo_conjunto dispara cuando 2 piezas comparten lámina', () => {
    expect(tipos).toContain('nesteo_conjunto');
    expect(m.find((x) => x.tipo === 'nesteo_conjunto').propuesta).toContain('ln22');
  });
  it('estandarizar_calibre dispara con un calibre propuesto (no del plano)', () => {
    expect(tipos).toContain('estandarizar_calibre');
  });
  it('aprovechamiento nombra la lámina real, no "undefined"', () => {
    const a = m.find((x) => x.tipo === 'aprovechamiento');
    expect(a).toBeTruthy();
    expect(a.propuesta).toContain('ln22');
    expect(a.propuesta).not.toContain('undefined');
  });
});
