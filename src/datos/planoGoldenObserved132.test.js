import { describe, it, expect } from 'vitest';
import { validarProgramaObservado } from '../../supabase/functions/leer-plano/observed-core.js';
import { programRequirementsDesdeObservado, proponerProgramaDesdeObservado } from './programaRealDelPlano.js';

// ============================================================================
//  GOLDEN HARNESS · QA-COT-01 (132 m²) · observed_program (ChatGPT P0-R8-7)
//
//  La LECTURA EN VIVO del PDF es BLOCKED_EXTERNAL (requiere el edge leer-plano +
//  modelo en prod; HARD BOUNDARY: no deploy). Aquí se prueba, OFFLINE y de forma
//  determinista, el CONTRATO GRABADO del pipeline:
//     [salida esperada del lector] → validador determinista (edge observed-core)
//        → ProgramRequirements (observed GOBIERNA) → ProductResolver.
//  Cuando el edge emita observed_program en vivo, este mismo golden valida la
//  salida real sin cambiar las aserciones.
//
//  Golden esperado (anclas OBSERVADAS en el plano de 132 m²):
//    R-01 ×1  recepción            → RECEPCION
//    B-01 ×4  bench, cap 2 = 8     → OPEN SPACE (8 PUESTOS, no "8 benches")
//    J-01 ×1  mesa juntas, cap 8   → SALA DE JUNTAS
//    D-01 ×1  escritorio dirección → DIRECCION
//    CR-01 ×1 credenza            → DIRECCION   (rol aún sin vocabulario → pendiente)
//    CF-01 ×1 coffee point        → COFFEE/PRINT (amenity, sin vocabulario → pendiente)
//  Las sillas S-01 ×8 (operativas) y SJ-01 ×8 (juntas) NO son líneas observadas:
//  son DEPENDIENTES obligatorios que resuelve el ProductResolver desde las anclas.
// ============================================================================
const ENV = { envelopeW: 15000, envelopeH: 8800 };
const ZONAS = new Set(['ARCHIVO / APOYO', 'COLABORACION', 'RECEPCION', 'OPEN SPACE', 'COFFEE / PRINT', 'DIRECCION', 'SALA DE JUNTAS']);

// Contrato GRABADO: lo que el lector debe entregar para este plano.
const RECORDED_OBSERVED = [
  { kind: 'furniture', type: 'recepcion', role: 'reception', quantity: 1, capacity_per_unit: 1, zone: 'RECEPCION', position: { x: 1600, y: 6600 }, page: 1, confidence: 0.92, evidence: 'mostrador dibujado en RECEPCION', origin: 'observed', source_ref: 'R-01' },
  { kind: 'furniture', type: 'bench', role: 'operational', quantity: 4, capacity_per_unit: 2, zone: 'OPEN SPACE', position: { x: 6900, y: 4400 }, page: 1, confidence: 0.9, evidence: '4 islas de bench en OPEN SPACE', origin: 'observed', source_ref: 'B-01' },
  { kind: 'furniture', type: 'mesa de juntas', role: 'meeting', quantity: 1, capacity_per_unit: 8, zone: 'SALA DE JUNTAS', position: { x: 12700, y: 7000 }, page: 1, confidence: 0.9, evidence: 'mesa con 8 sillas en SALA DE JUNTAS', origin: 'observed', source_ref: 'J-01' },
  { kind: 'furniture', type: 'escritorio', role: 'private_office', quantity: 1, capacity_per_unit: 1, zone: 'DIRECCION', position: { x: 12700, y: 4000 }, page: 1, confidence: 0.9, evidence: 'escritorio en DIRECCION', origin: 'observed', source_ref: 'D-01' },
  { kind: 'furniture', type: 'credenza', role: 'storage_credenza', quantity: 1, zone: 'DIRECCION', position: { x: 11000, y: 3000 }, page: 1, confidence: 0.8, evidence: 'credenza en DIRECCION', origin: 'observed', source_ref: 'CR-01' },
  { kind: 'amenity', type: 'coffee point', role: 'amenity_coffee', quantity: 1, zone: 'COFFEE / PRINT', position: { x: 12700, y: 1200 }, page: 1, confidence: 0.8, evidence: 'coffee point en COFFEE/PRINT', origin: 'observed', source_ref: 'CF-01' },
];

describe('GOLDEN observed_program · QA-COT-01 132 m² (P0-R8-7, offline recorded contract)', () => {
  it('el validador determinista del edge ACEPTA el contrato grabado (todo observado, 0 inválidos)', () => {
    const r = validarProgramaObservado(RECORDED_OBSERVED, { ...ENV, zoneNames: ZONAS });
    expect(r.metrics.total).toBe(6);
    expect(r.metrics.invalidos).toBe(0);
    expect(r.metrics.observados).toBe(6);        // las 6 anclas son OBSERVED-reales
    expect(r.state).toBe('PASS');                // sin issues ni pendientes de confirmar
    expect(r.issues).toEqual([]);
  });

  it('observed GOBIERNA el programa: 8 puestos, sala de 8, 1 dirección, recepción', () => {
    const { entrada, gobernables, pendientes } = programRequirementsDesdeObservado(RECORDED_OBSERVED);
    expect(entrada.operativos).toBe(8);          // B-01 ×4 × cap 2 = 8 PUESTOS
    expect(entrada.salas).toEqual([8]);          // J-01 cap 8
    expect(entrada.privados).toBe(1);            // D-01
    expect(entrada.recepcion).toBe(true);        // R-01
    expect(gobernables).toBe(4);
    // CR-01 (credenza) y CF-01 (coffee): válidos y observados, pero su ROL aún no
    // tiene vocabulario → NO se inventan, van a revisión (siguiente P0).
    expect(pendientes.filter((p) => p.code === 'ROLE_NO_MAPEADO')).toHaveLength(2);
  });

  it('el ProductResolver produce los DEPENDIENTES golden (sillas operativas y de juntas)', () => {
    const p = proponerProgramaDesdeObservado(RECORDED_OBSERVED, { linea: 'App LT' });
    expect(p).not.toBeNull();
    expect(p.gobernadoPorObservado).toBe(true);
    const roles = new Set((p.preview || []).map((x) => x.relation_role));
    expect(roles.has('WORK_SEAT')).toBe(true);       // S-01 ×8 (dependiente del bench)
    expect(roles.has('MEETING_SEAT')).toBe(true);    // SJ-01 (dependiente de la mesa)
  });

  it('DETERMINISTA: el golden no cambia entre corridas', () => {
    expect(programRequirementsDesdeObservado(RECORDED_OBSERVED))
      .toEqual(programRequirementsDesdeObservado(RECORDED_OBSERVED));
  });
});
