import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

// ChatGPT P0-2: el lector de planos debe PODER devolver mobiliario observado
// (observed_program) con evidencia/confianza/origen, y el cliente usarlo.
// PREPARADO (no desplegado): se verifica el schema/prompt del edge y que el
// cliente PREFIERE el observed_program real sobre la heurística de áreas.
describe('Plan reader · mobiliario observado preparado (P0-2)', () => {
  const edge = fs.readFileSync('supabase/functions/leer-plano-core/index.ts', 'utf8');
  const cli = fs.readFileSync('src/datos/leerPlanoArchivo.js', 'utf8');

  it('el schema del edge incluye observed_program con las propiedades requeridas (opcional)', () => {
    expect(edge).toContain('observed_program:');
    for (const p of ['type', 'role', 'quantity', 'capacity_per_unit', 'zone', 'position', 'orientation', 'dimensions', 'page', 'evidencia', 'confianza', 'origin']) {
      expect(edge, `falta propiedad ${p}`).toContain(`${p}:`);
    }
    // sigue siendo OPCIONAL: no está en el `required` top-level (no cambia comportamiento actual)
    expect(edge).toContain('required: ["envolvente", "grid", "areas", "puertas", "escala", "tieneCotas", "notas"]');
  });

  it('el prompt pide mobiliario VISIBLE con evidencia, sin SKU ni invención', () => {
    expect(edge).toContain('MOBILIARIO OBSERVADO');
    expect(edge).toContain('NUNCA elijas SKU');
    expect(edge).toContain("origin='observed' SÓLO si el mueble está DIBUJADO");
    expect(edge).toContain('capacity_per_unit');   // bench 2 usuarios → capacity, no 2 benches
  });

  it('el cliente PREFIERE el observed_program real del lector sobre la heurística de áreas', () => {
    expect(cli).toContain('Array.isArray(lec.observed_program) && lec.observed_program.length');
    expect(cli).toContain('observedProgramDeLectura(programaDelPlano(areas))');  // sólo como fallback
  });
});
