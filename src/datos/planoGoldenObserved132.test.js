import { describe, it, expect } from 'vitest';
import { validarProgramaObservado } from '../../supabase/functions/leer-plano/observed-core.js';
import { programRequirementsDesdeObservado, proponerProgramaDesdeObservado } from './programaRealDelPlano.js';

// ============================================================================
//  GOLDEN HARNESS · QA-COT-01 (132 m²) · observed_program (ChatGPT P0-R10-10)
//
//  MOCK_ONLY / RECORDED CONTRACT — NO es E2E del PDF vivo. La lectura en vivo del
//  PDF es BLOCKED_EXTERNAL (edge leer-plano + modelo en prod; HARD BOUNDARY).
//
//  Ground truth EXACTO de la tabla del PDF (cada fila con dimensión tiene assert):
//    R-01  Recepción especial  qty 1  2000×700
//    B-01  Bench 2 usuarios     qty 4  2400×1400 c/u   (ANCLA, 8 puestos)
//    S-01  Silla operativa      qty 8                  (DEPENDIENTE)
//    J-01  Mesa juntas          qty 1  3200×1200 / 8p  (ANCLA)
//    SJ-01 Silla juntas         qty 8                  (DEPENDIENTE)
//    D-01  Escritorio dirección qty 1  2000×900        (ANCLA privada)
//    CR-01 Credenza             qty 1  1200×500        (DEPENDIENTE storage)
//    CF-01 Coffee point         qty 1  3300×600        (AMENIDAD)
// ============================================================================
const ENV = { envelopeW: 15000, envelopeH: 8800 };
const ZONAS = new Set(['ARCHIVO / APOYO', 'COLABORACION', 'RECEPCION', 'OPEN SPACE', 'COFFEE / PRINT', 'DIRECCION', 'SALA DE JUNTAS']);

const GROUND_TRUTH = [
  { kind: 'furniture', type: 'recepcion', role: 'reception', quantity: 1, capacity_per_unit: 1, dimensions: { w: 2000, d: 700 }, zone: 'RECEPCION', position: { x: 1600, y: 6600 }, page: 1, confidence: 0.92, evidence: 'mostrador en RECEPCION', origin: 'observed', source_ref: 'R-01' },
  { kind: 'furniture', type: 'bench operativo', role: 'operational', quantity: 4, capacity_per_unit: 2, capacity_total: 8, dimensions: { w: 2400, d: 1400 }, zone: 'OPEN SPACE', position: { x: 6900, y: 4400 }, page: 1, confidence: 0.9, evidence: '4 islas de bench', origin: 'observed', source_ref: 'B-01' },
  { kind: 'furniture', type: 'silla operativa', role: 'work_seat', quantity: 8, zone: 'OPEN SPACE', position: { x: 7000, y: 4600 }, page: 1, confidence: 0.85, evidence: '8 sillas en los benches', origin: 'observed', source_ref: 'S-01' },
  { kind: 'furniture', type: 'mesa de juntas', role: 'meeting', quantity: 1, capacity_per_unit: 8, dimensions: { w: 3200, d: 1200 }, zone: 'SALA DE JUNTAS', position: { x: 12700, y: 7000 }, page: 1, confidence: 0.9, evidence: 'mesa con 8 lugares', origin: 'observed', source_ref: 'J-01' },
  { kind: 'furniture', type: 'silla de juntas', role: 'meeting_seat', quantity: 8, zone: 'SALA DE JUNTAS', position: { x: 12800, y: 7100 }, page: 1, confidence: 0.85, evidence: '8 sillas alrededor', origin: 'observed', source_ref: 'SJ-01' },
  { kind: 'furniture', type: 'escritorio dirección', role: 'private_office', quantity: 1, capacity_per_unit: 1, dimensions: { w: 2000, d: 900 }, zone: 'DIRECCION', position: { x: 12700, y: 4000 }, page: 1, confidence: 0.9, evidence: 'escritorio en DIRECCION', origin: 'observed', source_ref: 'D-01' },
  { kind: 'furniture', type: 'credenza', role: 'storage', quantity: 1, dimensions: { w: 1200, d: 500 }, zone: 'DIRECCION', position: { x: 11000, y: 3000 }, page: 1, confidence: 0.8, evidence: 'credenza en DIRECCION', origin: 'observed', source_ref: 'CR-01' },
  { kind: 'amenity', type: 'coffee point', role: 'amenity_coffee', quantity: 1, dimensions: { w: 3300, d: 600 }, zone: 'COFFEE / PRINT', position: { x: 12700, y: 1200 }, page: 1, confidence: 0.8, evidence: 'coffee point', origin: 'observed', source_ref: 'CF-01' },
];
const fila = (r, ref) => r.items.find((x) => x.source_ref === ref);

describe('GOLDEN observed_program · QA-COT-01 132 m² (P0-R10-10, MOCK_ONLY/RECORDED)', () => {
  const r = validarProgramaObservado(GROUND_TRUTH, { ...ENV, zoneNames: ZONAS });

  it('READER: acepta el documento completo (8 filas) sin inválidos', () => {
    expect(r.metrics.total).toBe(8);
    expect(r.metrics.invalidos).toBe(0);
    expect(r.state).toBe('PASS');
  });
  it('READER dims EXACTAS R-01 2000×700', () => { expect(fila(r, 'R-01').dimensions).toEqual({ w: 2000, d: 700, h: null }); });
  it('READER dims EXACTAS B-01 2400×1400 + capacidad 8', () => {
    expect(fila(r, 'B-01').dimensions).toEqual({ w: 2400, d: 1400, h: null });
    expect(fila(r, 'B-01').capacity_total).toBe(8);
    expect(fila(r, 'B-01').quantity).toBe(4);
  });
  it('READER dims EXACTAS J-01 3200×1200', () => { expect(fila(r, 'J-01').dimensions).toEqual({ w: 3200, d: 1200, h: null }); });
  it('READER dims EXACTAS D-01 2000×900', () => { expect(fila(r, 'D-01').dimensions).toEqual({ w: 2000, d: 900, h: null }); });
  it('READER dims EXACTAS CR-01 1200×500 (corregido, antes 1800×500)', () => { expect(fila(r, 'CR-01').dimensions).toEqual({ w: 1200, d: 500, h: null }); });
  it('READER dims EXACTAS CF-01 3300×600', () => { expect(fila(r, 'CF-01').dimensions).toEqual({ w: 3300, d: 600, h: null }); });
  it('READER conserva las sillas del documento (S-01 ×8, SJ-01 ×8)', () => {
    expect(fila(r, 'S-01').quantity).toBe(8);
    expect(fila(r, 'SJ-01').quantity).toBe(8);
  });

  const red = programRequirementsDesdeObservado(GROUND_TRUTH);
  it('GOBIERNA: 8 puestos', () => { expect(red.entrada.operativos).toBe(8); });
  it('GOBIERNA: sala de 8 (por unidad)', () => { expect(red.entrada.salas).toEqual([8]); });
  it('GOBIERNA: 1 dirección', () => { expect(red.entrada.privados).toBe(1); });
  it('GOBIERNA: recepción', () => { expect(red.entrada.recepcion).toBe(true); });
  it('ANCLA B-01 conserva su geometría física 2400×1400', () => {
    expect(red.anclasObservadas.find((a) => a.source_ref === 'B-01').dimensions).toEqual({ w: 2400, d: 1400, h: null });
  });
  it('DEPENDIENTES observados = sillas operativa/juntas + credenza (storage)', () => {
    expect(red.dependientesObservados.map((d) => d.dependent_role).sort()).toEqual(['MEETING_SEAT', 'STORAGE', 'WORK_SEAT']);
  });
  it('CF-01 amenidad → pendiente de revisión (no ancla, no inventada)', () => {
    expect(red.pendientes.some((p) => p.code === 'AMENITY_SIN_VOCABULARIO')).toBe(true);
  });

  const p = proponerProgramaDesdeObservado(GROUND_TRUTH, { linea: 'App LT' });
  it('ANTI-SUSTITUCIÓN: B-01 2400×1400 sin equivalente canónico → NEEDS_CONFIRMATION (exacto)', () => {
    expect(p.anclasConciliadas.find((a) => a.source_ref === 'B-01').estado).toBe('NEEDS_CONFIRMATION');
  });
  it('APPLY GATE: requiere revisión → el programa NO se auto-aplica', () => {
    expect(p.requiereRevision).toBe(true);
  });
  it('CR-01 observado NO desaparece: reconciliación STORAGE = OBSERVED_ONLY', () => {
    const st = p.dependientesConciliados.find((d) => d.dependent_role === 'STORAGE');
    expect(st.estado).toBe('OBSERVED_ONLY');
    expect(st.observados).toBe(1);
  });
  it('SIN DUPLICAR: las sillas observadas no suman puestos (operativos sigue 8)', () => {
    expect(red.entrada.operativos).toBe(8);
    expect(p.dependientesConciliados.find((d) => d.dependent_role === 'WORK_SEAT').observados).toBe(8);
  });
  it('DETERMINISTA: el golden no cambia entre corridas', () => {
    expect(programRequirementsDesdeObservado(GROUND_TRUTH)).toEqual(programRequirementsDesdeObservado(GROUND_TRUTH));
  });
});
