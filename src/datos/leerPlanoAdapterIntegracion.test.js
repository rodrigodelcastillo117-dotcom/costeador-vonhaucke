import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock de la red: el adapter real leerPlanoDeArchivo llama a nube.leerPlano.
vi.mock('../nube.js', () => ({ leerPlano: vi.fn() }));
import { leerPlano } from '../nube.js';
import { leerPlanoDeArchivo } from './leerPlanoArchivo.js';
import { proponerProgramaDesdeObservado, propuestaBloqueada } from './programaRealDelPlano.js';

// Stub mínimo de FileReader (node) para que archivoABase64 resuelva un PDF.
class FRStub {
  readAsDataURL() { this.result = 'data:application/pdf;base64,QUJD'; setTimeout(() => this.onload && this.onload(), 0); }
}
beforeEach(() => { globalThis.FileReader = FRStub; leerPlano.mockReset(); });

const LECTURA = {
  envolvente: { ancho: 15000, largo: 8800 }, grid: { horizontal: [], vertical: [] },
  areas: [{ nombre: 'OPEN SPACE', tipo: 'open', forma: 'poligono', puntos: [{ x: 0, y: 0 }, { x: 3000, y: 0 }, { x: 3000, y: 3000 }, { x: 0, y: 3000 }], dentroDe: '', puestos: 4, confianza: 'alta' }],
  puertas: [], tieneCotas: true, notas: [],
};
const FILE = { size: 1000, name: 'plano.pdf', type: 'application/pdf' };
const resp = (observed, validationState) => ({
  ok: true, request_id: 'r1', lectura: LECTURA,
  floorSpec: { observed_program: observed, observed_validation: validationState ? { state: validationState } : undefined },
  observed_program: observed,
});

describe('ADAPTER REAL leerPlanoArchivo + gate de aplicación (ChatGPT R11 P1)', () => {
  it('server PASS → PRESENT_VALID; el cliente consume el observed SANEADO del servidor', async () => {
    const observed = [{ kind: 'furniture', type: 'bench operativo', role: 'operational', quantity: 4, capacity_per_unit: 2, capacity_total: 8, dimensions: { w: 1500, d: 1200 }, zone: 'OPEN SPACE', position: { x: 100, y: 100 }, confidence: 0.9, evidence: 'x', origin: 'observed', source_ref: 'B-01', issues: [], review_required: false }];
    leerPlano.mockResolvedValue(resp(observed, 'PASS'));
    const r = await leerPlanoDeArchivo(FILE);
    expect(r.ok).toBe(true);
    expect(r.observed_source).toBe('server');
    expect(r.observed_state).toBe('PRESENT_VALID');
    expect(r.observed_program[0].source_ref).toBe('B-01');
    // governor identity-first: 4× op-2u-1500x1200, aplicable
    const prop = proponerProgramaDesdeObservado(r.observed_program, { linea: 'App LT' });
    expect(prop.propuesta.partidas.filter((p) => p.bancoId === 'op-2u-1500x1200').length).toBe(4);
    expect(propuestaBloqueada(prop.propuesta)).toBe(false);
  });

  it('FAIL-CLOSED (R11-5): observed_validation ausente → PRESENT_REVIEW_REQUIRED (nunca null ⇒ VALID)', async () => {
    const observed = [{ kind: 'furniture', type: 'bench operativo', role: 'operational', quantity: 4, capacity_per_unit: 2, capacity_total: 8, dimensions: { w: 1500, d: 1200 }, zone: 'OPEN SPACE', position: { x: 100, y: 100 }, confidence: 0.9, evidence: 'x', origin: 'observed', source_ref: 'B-01' }];
    leerPlano.mockResolvedValue(resp(observed, null));
    const r = await leerPlanoDeArchivo(FILE);
    expect(r.observed_source).toBe('server');
    expect(r.observed_state).toBe('PRESENT_REVIEW_REQUIRED');
  });

  it('GATE: CR-01 observada sin producto → propuesta BLOQUEADA aunque un caller la pase', async () => {
    const observed = [
      { kind: 'furniture', type: 'recepcion', role: 'reception', quantity: 1, capacity_per_unit: 1, dimensions: { w: 2420, d: 830 }, zone: 'OPEN SPACE', position: { x: 100, y: 100 }, confidence: 0.9, evidence: 'x', origin: 'observed', source_ref: 'R-01' },
      { kind: 'furniture', type: 'credenza', role: 'storage', quantity: 1, zone: 'OPEN SPACE', position: { x: 200, y: 200 }, confidence: 0.9, evidence: 'x', origin: 'observed', source_ref: 'CR-01' },
    ];
    leerPlano.mockResolvedValue(resp(observed, 'PASS'));
    const r = await leerPlanoDeArchivo(FILE);
    const prop = proponerProgramaDesdeObservado(r.observed_program, { linea: 'App LT' });
    expect(propuestaBloqueada(prop.propuesta)).toBe(true);
  });

  it('sin observed server (ABSENT) → heurística por áreas permitida', async () => {
    leerPlano.mockResolvedValue({ ok: true, request_id: 'r1', lectura: LECTURA, floorSpec: {}, observed_program: [] });
    const r = await leerPlanoDeArchivo(FILE);
    expect(r.observed_state).toBe('ABSENT');
    expect(['heuristic', 'none']).toContain(r.observed_source);
  });
});
