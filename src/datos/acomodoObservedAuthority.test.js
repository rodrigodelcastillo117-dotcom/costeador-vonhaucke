import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { proponerProgramaDesdeObservado, aplicarPrograma } from './programaRealDelPlano.js';

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
