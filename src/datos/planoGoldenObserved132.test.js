import { describe, it, expect } from 'vitest';
import { validarProgramaObservado } from '../../supabase/functions/leer-plano/observed-core.js';
import { programRequirementsDesdeObservado, proponerProgramaDesdeObservado } from './programaRealDelPlano.js';

// ============================================================================
//  GOLDEN HARNESS · QA-COT-01 (132 m²) · observed_program (ChatGPT P0-R9-9)
//
//  La LECTURA EN VIVO del PDF es BLOCKED_EXTERNAL (edge leer-plano + modelo en
//  prod; HARD BOUNDARY: no deploy). Este golden prueba OFFLINE el CONTRATO GRABADO
//  del pipeline con el GROUND TRUTH COMPLETO del documento.
//
//  El reader-golden mide LO QUE EL DOCUMENTO CONTIENE (incluye sillas S-01/SJ-01;
//  NO se omiten porque el resolver genere dependientes). Un test aparte verifica
//  la RECONCILIACIÓN (ancla + dependiente observados vs dependiente requerido →
//  NO duplicar) y que NO haya SUSTITUCIÓN SILENCIOSA por capacidad (P0-R9-8).
//
//  Ground truth real (con dimensiones):
//    R-01  ×1  recepción            2000×700   → RECEPCION
//    B-01  ×4  bench, 2 u c/u       2400×1400  → OPEN SPACE   (ANCLA, 8 puestos)
//    S-01  ×8  silla operativa                 → OPEN SPACE   (DEPENDIENTE)
//    J-01  ×1  mesa de juntas, 8 u  3200×1200  → SALA DE JUNTAS (ANCLA)
//    SJ-01 ×8  silla de juntas                 → SALA DE JUNTAS (DEPENDIENTE)
//    D-01  ×1  escritorio dirección 2000×900   → DIRECCION    (ANCLA privada)
//    CR-01 ×1  credenza                        → DIRECCION    (DEPENDIENTE storage)
//    CF-01 ×1  coffee point                    → COFFEE/PRINT (AMENIDAD)
// ============================================================================
const ENV = { envelopeW: 15000, envelopeH: 8800 };
const ZONAS = new Set(['ARCHIVO / APOYO', 'COLABORACION', 'RECEPCION', 'OPEN SPACE', 'COFFEE / PRINT', 'DIRECCION', 'SALA DE JUNTAS']);

const GROUND_TRUTH = [
  { kind: 'furniture', type: 'recepcion', role: 'reception', quantity: 1, capacity_per_unit: 1, dimensions: { w: 2000, d: 700 }, zone: 'RECEPCION', position: { x: 1600, y: 6600 }, page: 1, confidence: 0.92, evidence: 'mostrador en RECEPCION', origin: 'observed', source_ref: 'R-01' },
  { kind: 'furniture', type: 'bench operativo', role: 'operational', quantity: 4, capacity_per_unit: 2, dimensions: { w: 2400, d: 1400 }, zone: 'OPEN SPACE', position: { x: 6900, y: 4400 }, page: 1, confidence: 0.9, evidence: '4 islas de bench en OPEN SPACE', origin: 'observed', source_ref: 'B-01' },
  { kind: 'furniture', type: 'silla operativa', role: 'work_seat', quantity: 8, zone: 'OPEN SPACE', position: { x: 7000, y: 4600 }, page: 1, confidence: 0.85, evidence: '8 sillas en los benches', origin: 'observed', source_ref: 'S-01' },
  { kind: 'furniture', type: 'mesa de juntas', role: 'meeting', quantity: 1, capacity_per_unit: 8, dimensions: { w: 3200, d: 1200 }, zone: 'SALA DE JUNTAS', position: { x: 12700, y: 7000 }, page: 1, confidence: 0.9, evidence: 'mesa con 8 lugares', origin: 'observed', source_ref: 'J-01' },
  { kind: 'furniture', type: 'silla de juntas', role: 'meeting_seat', quantity: 8, zone: 'SALA DE JUNTAS', position: { x: 12800, y: 7100 }, page: 1, confidence: 0.85, evidence: '8 sillas alrededor de la mesa', origin: 'observed', source_ref: 'SJ-01' },
  { kind: 'furniture', type: 'escritorio dirección', role: 'private_office', quantity: 1, capacity_per_unit: 1, dimensions: { w: 2000, d: 900 }, zone: 'DIRECCION', position: { x: 12700, y: 4000 }, page: 1, confidence: 0.9, evidence: 'escritorio en DIRECCION', origin: 'observed', source_ref: 'D-01' },
  { kind: 'furniture', type: 'credenza', role: 'storage', quantity: 1, dimensions: { w: 1800, d: 500 }, zone: 'DIRECCION', position: { x: 11000, y: 3000 }, page: 1, confidence: 0.8, evidence: 'credenza en DIRECCION', origin: 'observed', source_ref: 'CR-01' },
  { kind: 'amenity', type: 'coffee point', role: 'amenity_coffee', quantity: 1, zone: 'COFFEE / PRINT', position: { x: 12700, y: 1200 }, page: 1, confidence: 0.8, evidence: 'coffee point', origin: 'observed', source_ref: 'CF-01' },
];

describe('GOLDEN observed_program · QA-COT-01 132 m² (P0-R9-9, ground truth completo)', () => {
  it('READER GOLDEN: el validador acepta el documento COMPLETO (8 filas, incluye S-01/SJ-01), 0 inválidos', () => {
    const r = validarProgramaObservado(GROUND_TRUTH, { ...ENV, zoneNames: ZONAS });
    expect(r.metrics.total).toBe(8);
    expect(r.metrics.invalidos).toBe(0);
    expect(r.state).toBe('PASS');
    // exactitud del lector: cada ancla preserva dims/capacidad/zone/source_ref
    const bench = r.items.find((x) => x.source_ref === 'B-01');
    expect(bench.dimensions).toEqual({ w: 2400, d: 1400, h: null });
    expect(bench.capacity_total).toBe(8);             // 4 × 2
    expect(bench.zone).toBe('OPEN SPACE');
    const junta = r.items.find((x) => x.source_ref === 'J-01');
    expect(junta.dimensions).toEqual({ w: 3200, d: 1200, h: null });
    // las sillas SÍ están en el golden (no se omiten)
    expect(r.items.filter((x) => /silla/.test(x.type)).map((x) => x.source_ref).sort()).toEqual(['S-01', 'SJ-01']);
  });

  it('GOBIERNA + preserva identidad física: 8 puestos / sala 8 / dirección / recepción; dims conservadas', () => {
    const red = programRequirementsDesdeObservado(GROUND_TRUTH);
    expect(red.entrada.operativos).toBe(8);           // B-01 ancla, NO las sillas
    expect(red.entrada.salas).toEqual([8]);           // J-01 por unidad
    expect(red.entrada.privados).toBe(1);             // D-01
    expect(red.entrada.recepcion).toBe(true);         // R-01
    // ANCLAS conservan su geometría (P0-R9-8)
    const bench = red.anclasObservadas.find((a) => a.source_ref === 'B-01');
    expect(bench.dimensions).toEqual({ w: 2400, d: 1400, h: null });
    expect(bench.quantity).toBe(4);
    // DEPENDIENTES observados NO inflan el programa; quedan para reconciliar
    const depRoles = red.dependientesObservados.map((d) => d.dependent_role).sort();
    expect(depRoles).toEqual(['MEETING_SEAT', 'STORAGE', 'WORK_SEAT']);
    // CF-01 amenidad → revisión, no inventada
    expect(red.pendientes.some((p) => p.code === 'AMENITY_SIN_VOCABULARIO')).toBe(true);
  });

  it('NO SUSTITUCIÓN SILENCIOSA (P0-R9-8): el bench 2400×1400 nunca se da por RESUELTO con otra geometría', () => {
    const p = proponerProgramaDesdeObservado(GROUND_TRUTH, { linea: 'App LT' });
    expect(p).not.toBeNull();
    const benchConc = p.anclasConciliadas.find((a) => a.source_ref === 'B-01');
    expect(benchConc).toBeTruthy();
    // Si el resolver eligió un producto por capacidad con OTRA geometría, el ancla
    // NO puede quedar RESOLVED: debe pedir confirmación (REQUIERE_DESARROLLO).
    expect(['RESOLVED', 'NEEDS_CONFIRMATION', 'NEEDS_DIMENSIONS']).toContain(benchConc.estado);
    if (benchConc.estado === 'RESOLVED') {
      const close = (x, y) => Math.abs(x - y) <= Math.max(60, Math.max(x, y) * 0.06);
      const ok = (close(benchConc.w, 2400) && close(benchConc.d, 1400)) || (close(benchConc.w, 1400) && close(benchConc.d, 2400));
      expect(ok, `RESOLVED debe coincidir en dims; eligió ${benchConc.w}×${benchConc.d}`).toBe(true);
    }
  });

  it('SIN DUPLICAR DEPENDIENTES (P0-R9-9): las sillas observadas no se suman sobre las del resolver', () => {
    const p = proponerProgramaDesdeObservado(GROUND_TRUTH, { linea: 'App LT' });
    // el programa operativo sigue en 8 (no 8 + 8 sillas)
    const red = programRequirementsDesdeObservado(GROUND_TRUTH);
    expect(red.entrada.operativos).toBe(8);
    // la reconciliación reporta las sillas observadas (8/8) para contraste, no como extra
    const ws = p.dependientesConciliados.find((d) => d.dependent_role === 'WORK_SEAT');
    expect(ws?.observados).toBe(8);
  });

  it('DETERMINISTA: el golden no cambia entre corridas', () => {
    expect(programRequirementsDesdeObservado(GROUND_TRUTH)).toEqual(programRequirementsDesdeObservado(GROUND_TRUTH));
  });
});
