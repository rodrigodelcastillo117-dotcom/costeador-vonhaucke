import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { proponerProgramaDesdeObservado, aplicarPrograma } from './programaRealDelPlano.js';

// R15-E2 + P1-R15-I: el gate de conflictos de reconciliación vive en el PUNTO ATÓMICO
// (dentro de setEstado(prev)) y, además, tanto el WRITE como el RETURN derivan de la
// MISMA autoridad `resolverAplicacionAtomica` contra `prev` (no un snapshot externo).
describe('App.aplicarProgramaDetectado · gate atómico vía autoridad única (R15-E2 / P1-R15-I)', () => {
  const app = fs.readFileSync('src/App.jsx', 'utf8');
  it('decide el commit DENTRO del updater contra prev y devuelve prev si no hay commit', () => {
    expect(app).toContain('setEstado((prev) => {');
    expect(app).toContain('const atomic = resolverAplicacionAtomica(propuesta, { existentes });');
    // fail-closed / idempotente: 0 writes → devuelve el mismo prev
    expect(app).toContain('if (!atomic.committed) return prev;');
    // el return refleja el commit atómico, no el snapshot `vista`
    expect(app).not.toContain('const vista = aplicarPrograma(propuesta, { existentes: estado.cotizacion?.partidas || [] });');
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

  // P0-R15-F: Acomodo arma UN conjunto combinado de bloqueos (coherencia estructural +
  // autoridad observada) y lo pasa a AcomodoBase → programaListo depende de TODO ello.
  it('F-wiring: Acomodo combina coherencia + bloqueosProgramaObservado y lo pasa a AcomodoBase', () => {
    expect(src).toContain("import { proponerProgramaDelPlano, proponerProgramaDesdeObservado, aplicarPrograma, bloqueosProgramaObservado }");
    expect(src).toContain('bloqueosProgramaObservado(propuestaPlano, { partidas: partidasActuales })');
    expect(src).toContain('const bloqueosProgramaUI = [...(coherenciaPrograma.bloqueos || []), ...bloqueosObserved];');
    expect(src).toContain('bloqueosPrograma={bloqueosProgramaUI}');
  });

  // P1-R15-G: el botón "Aplicar programa detectado" se deshabilita también por CONFLICTOS
  // de reconciliación (no sólo requiereRevision) y muestra el motivo concreto.
  it('G: "Aplicar programa detectado" deshabilitado por conflictos + motivo visible', () => {
    expect(src).toContain('(reconObs?.conflictos?.length || 0) > 0');
    expect(src).toContain('CONFLICTO:');
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

// P1-R15-J: VONI refleja el ESTADO REAL de la sillería. Cuando ya no queda nada por
// confirmar (sillasPorConfirmar=false), muestra "✓ Sillería confirmada", no el texto
// permanente "modelo por confirmar".
describe('Voni · encabezado de sillería refleja el estado real (R15-J)', () => {
  const voni = fs.readFileSync('src/componentes/Voni.jsx', 'utf8');
  it('muestra "✓ Sillería confirmada" cuando !sillasPorConfirmar', () => {
    expect(voni).toContain("sillasPorConfirmar ? 'Sillería (modelo por confirmar)' : '✓ Sillería confirmada'");
    // el "· confirma modelo" por renglón sólo aparece mientras falta confirmar
    expect(voni).toContain("sillasPorConfirmar ? ' · confirma modelo' : ''");
  });
});
