import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { proponerProgramaDesdeObservado, aplicarPrograma } from './programaRealDelPlano.js';

// R15-E2: el gate de conflictos de reconciliación debe vivir en el PUNTO ATÓMICO
// (dentro de setEstado(prev)), no sólo en el precheck externo contra el snapshot.
describe('App.aplicarProgramaDetectado · gate atómico de conflictos (R15-E2)', () => {
  const app = fs.readFileSync('src/App.jsx', 'utf8');
  it('revalida conflictos contra prev dentro del updater y NO escribe si los hay', () => {
    expect(app).toContain('setEstado((prev) => {');
    expect(app).toContain('const aplicado = aplicarPrograma(propuesta, { existentes });');
    // la revalidación ocurre contra prev y, con conflictos, devuelve el mismo prev (0 writes)
    expect(app).toContain('if ((aplicado.conflictos || []).length > 0) return prev;');
  });
});

// ChatGPT R12-4: Acomodo NO puede abandonar el observed_program sólo porque ya
// existan partidas (el bypass `hayReales ? null`). La reconciliación contra
// partidas existentes la hace confirmarPrograma (cubierta en confirmarPrograma.test.js);
// aquí se verifica (a) que el bypass se eliminó y el observed es la primera autoridad,
// y (b) que el camino de dominio conserva lo existente y sólo agrega lo nuevo.
describe('Acomodo · autoridad única observed con partidas existentes (R12-4)', () => {
  const src = fs.readFileSync('src/componentes/Acomodo.jsx', 'utf8');

  it('elimina el bypass `hayReales ? null` y pone el observed como PRIMERA autoridad', () => {
    expect(src).not.toContain('const propuestaPlano = hayReales ? null');
    expect(src).toContain('const propuestaPlano = observadoPresente');
    // sólo ABSENT (sin observed) y sin reales cae a la heurística por áreas
    expect(src).toContain('!hayReales && areasActuales.length');
  });

  it('DOMINIO: observed + partidas existentes → conserva lo existente y sólo agrega lo faltante', () => {
    const obs = [{ kind: 'furniture', type: 'bench operativo', role: 'operational', quantity: 1, capacity_per_unit: 2, capacity_total: 2, dimensions: { w: 1500, d: 1200 }, zone: 'OPEN SPACE', position: { x: 10, y: 10 }, confidence: 0.9, evidence: 'x', origin: 'observed', source_ref: 'B-01' }];
    const prop = proponerProgramaDesdeObservado(obs, { linea: 'App LT' });
    // una partida ya existente IDÉNTICA (mismo requirement_id/instance) → se reutiliza, no se duplica
    const yaExiste = prop.propuesta.partidas.map((p) => ({ ...p }));
    const aplicado = aplicarPrograma(prop.propuesta, { existentes: yaExiste });
    expect(aplicado.confirmacion.confirmadas.length).toBe(0);     // nada nuevo: ya estaba
    expect(aplicado.ok).toBe(true);
  });
});
