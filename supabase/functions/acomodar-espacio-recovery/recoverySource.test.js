import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

const idx = fs.readFileSync('supabase/functions/acomodar-espacio-recovery/index.ts', 'utf8');
const core = fs.readFileSync('supabase/functions/acomodar-espacio-recovery/recovery-core.js', 'utf8');
const nube = fs.readFileSync('src/nube.js', 'utf8');

describe('acomodar-espacio-recovery · fuente bajo control de código (P0.2)', () => {
  it('contrato VERSIONADO de entrada/salida', () => {
    expect(core).toContain("input_version: 'ACOMODO_INPUT_V1'");
    expect(core).toContain("output_version: 'PLACEMENT_SPEC_V2_RECOVERY'");
    expect(idx).toContain('input_version: CONTRATO.input_version');
    expect(idx).toContain('version: CONTRATO.output_version');
  });

  it('MUROS como first-class (invariante dura)', () => {
    expect(core).toContain('export function invariantesMuros');
    expect(core).toContain("code: 'WALL_CROSS'");
  });

  it('CIRCULACIÓN con ancho de pasillo como regla dura', () => {
    expect(core).toContain('export function invariantesCirculacion');
    expect(core).toContain("code: 'CIRCULATION_TIGHT'");
    expect(core).toContain('min_pasillo_mm: 1000');
  });

  it('bounds, puertas, obstáculos, overlaps, cobertura', () => {
    expect(core).toContain("code: 'OUT_OF_BOUNDS'");
    expect(core).toContain("code: 'BLOCKS_DOOR'");
    expect(core).toContain("code: 'HITS_OBSTACLE'");
    expect(core).toContain("code: 'OVERLAP'");
    expect(core).toContain("code: 'PLACEMENT_INVARIANT_BROKEN'");
  });

  it('semilla DETERMINISTA + repair loop REAL ≤ 3 + multi-zona/anchors', () => {
    expect(idx).toContain('planearDeterminista');
    expect(idx).toContain('proponerReparacion');            // reparación real, no re-devolver seed
    expect(idx).toContain('attemptsUsed < 3');
    expect(idx).toContain('no se finge intento');           // sin cambio concreto → no finge
    expect(idx).toContain('repair_trace');                  // rastro por intento
    expect(idx).toContain('prepararGruposFuncionales');     // anchors/dependents + multi-zona
  });
  it('recovery-core expone reparación determinista que conserva válidas', () => {
    expect(core).toContain('export function proponerReparacion');
    expect(core).toContain('conserva las colocaciones');
  });

  it('render_ready SÓLO si todo pasa (status real, no PASS con warnings)', () => {
    expect(core).toContain("const render_ready = status === 'PASS';");
    expect(core).toContain("status = repairAgotado ? 'NEEDS_REVIEW' : 'FAIL'");
    expect(core).toContain("status = 'PARTIAL'");
  });

  it('PENDIENTE DE ACTIVACIÓN: no desplegada y nube.js NO repunteada', () => {
    expect(idx).toContain('PENDIENTE DE ACTIVACIÓN');
    expect(idx).toContain('NO ESTÁ DESPLEGADA');
    // El cliente sigue invocando la función viva (no se repuntó a la fuente nueva
    // ni a la productiva): contrato del recovery lane intacto.
    expect(nube).toContain("invoke('acomodar-espacio-recovery'");
    expect(nube).not.toContain("invoke('acomodar-espacio',");
  });
});
