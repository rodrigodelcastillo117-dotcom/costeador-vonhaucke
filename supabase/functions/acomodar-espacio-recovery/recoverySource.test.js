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

  it('MOTOR kit-solver determinista (P0.2b): dueños + kits + backtracking', () => {
    expect(idx).toContain('resolverKits');                  // motor por bloques
    expect(idx).toContain('kit-solver.js');
    expect(idx).toContain('anchor_instance_id');            // dueños asignados
    expect(idx).toContain('no_cupieron');                   // faltantes causales (mejor parcial)
    expect(idx).toContain('prepararGruposFuncionales');     // anchors/dependents + multi-zona
  });
  it('kit-solver expone asignación de dueño + kits + backtracking', () => {
    const ks = fs.readFileSync('supabase/functions/acomodar-espacio-recovery/kit-solver.js', 'utf8');
    expect(ks).toContain('export function asignarDuenos');
    expect(ks).toContain('export function componerKit');
    expect(ks).toContain('export function resolverKits');
    expect(ks).toContain('backtracking');
  });
  it('validador relacional DURO (D): DEPENDENT_DETACHED/UNASSIGNED', () => {
    expect(core).toContain("code: 'DEPENDENT_DETACHED'");
    expect(core).toContain("code: 'DEPENDENT_UNASSIGNED'");
    expect(core).toContain('invariantesRelacionales');
  });

  it('render_ready SÓLO si todo pasa (status real, no PASS con warnings)', () => {
    expect(core).toContain("const render_ready = status === 'PASS';");
    expect(core).toContain("status = repairAgotado ? 'NEEDS_REVIEW' : 'FAIL'");
    expect(core).toContain("status = 'PARTIAL'");
  });

  it('SELF-CONTAINED: sin imports cruzados a ../acomodar-espacio (deploy aislado)', () => {
    // Supabase empaqueta cada función desde su propio directorio; los imports
    // cruzados causaban deploy status 500. Los cores van vendorizados aquí.
    expect(idx).not.toContain('../acomodar-espacio/');
    expect(core).not.toContain('../acomodar-espacio/');
    expect(idx).toContain("from './acomodo-core.js'");
    expect(core).toContain("from './spatial-core.js'");
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
