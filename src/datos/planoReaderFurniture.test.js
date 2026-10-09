import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

// ChatGPT P0-2: el lector de planos debe PODER devolver mobiliario observado
// (observed_program) con evidencia/confianza/origen, y el cliente usarlo.
// PREPARADO (no desplegado): se verifica el schema/prompt del edge y que el
// cliente PREFIERE el observed_program real sobre la heurística de áreas.
describe('Plan reader · mobiliario observado preparado (P0-2)', () => {
  const edge = fs.readFileSync('supabase/functions/leer-plano-core/index.ts', 'utf8');
  const cli = fs.readFileSync('src/datos/leerPlanoArchivo.js', 'utf8');

  it('el schema del edge incluye observed_program con las propiedades requeridas (P0-R9-2)', () => {
    expect(edge).toContain('observed_program:');
    // P0-R9-2: el schema ya PUEDE emitir kind/source_ref/plan_tag/grouping/capacity_total
    for (const p of ['kind', 'type', 'role', 'quantity', 'capacity_per_unit', 'capacity_total', 'zone', 'grouping', 'position', 'orientation', 'dimensions', 'page', 'source_ref', 'plan_tag', 'evidencia', 'confianza', 'origin']) {
      expect(edge, `falta propiedad ${p}`).toContain(`${p}:`);
    }
    // sigue siendo OPCIONAL: no está en el `required` top-level (no cambia comportamiento actual)
    expect(edge).toContain('required: ["envolvente", "grid", "areas", "puertas", "escala", "tieneCotas", "notas"]');
  });

  it('el prompt pide mobiliario VISIBLE con evidencia, distingue ANCLA/DEPENDIENTE, sin SKU ni invención', () => {
    expect(edge).toContain('MOBILIARIO OBSERVADO');
    expect(edge).toContain('NUNCA elijas SKU');
    expect(edge).toContain("origin='observed' SÓLO si el mueble está DIBUJADO");
    expect(edge).toContain('capacity_per_unit');   // bench 2 usuarios → capacity, no 2 benches
    // P0-R9-6: las sillas son DEPENDIENTES, no anclas (no inflan puestos/salas)
    expect(edge).toContain('ANCLA vs DEPENDIENTE');
    expect(edge).toContain('NO conviertas sillas en puestos ni en salas');
  });

  it('P0-R9-1: el cliente consume el observed_program SANEADO POR EL SERVIDOR, nunca el crudo de la IA', () => {
    // autoridad = r.observed_program / r.floorSpec.observed_program (ya validado server-side)
    expect(cli).toContain('Array.isArray(r.observed_program)');
    expect(cli).toContain('r.floorSpec?.observed_program');
    // NO se re-mapea el crudo de la IA (lec.observed_program) para gobernar el programa
    expect(cli).not.toContain('lec.observed_program');
    // la heurística por áreas SÓLO cuando el lector no dio mobiliario (ABSENT)
    expect(cli).toContain('observedProgramDeLectura(programaDelPlano(areas))');
    expect(cli).toContain("observed_state");
  });
});
