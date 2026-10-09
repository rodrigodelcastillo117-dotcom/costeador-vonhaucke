import { describe, it, expect } from 'vitest';
import { validarProgramaObservado } from '../../supabase/functions/leer-plano/observed-core.js';
import { programRequirementsDesdeObservado, proponerProgramaDesdeObservado } from './programaRealDelPlano.js';

// ============================================================================
//  INTEGRACIÓN OFFLINE (ChatGPT R10) — NO es E2E del PDF vivo (MOCK_ONLY).
//  Thread completo:
//    server raw item → validarProgramaObservado() (edge) → autoridad cliente
//    → programRequirementsDesdeObservado() → ProductResolver → reconciliación
//    → apply gate.
//  Prueba CONDUCTA del sistema, no strings de código.
// ============================================================================
const ENV = { envelopeW: 15000, envelopeH: 8800 };
const ZONAS = new Set(['RECEPCION', 'OPEN SPACE', 'SALA DE JUNTAS', 'DIRECCION', 'COFFEE / PRINT']);

// Simula el wrapper + la autoridad del cliente: el servidor valida; el cliente
// consume los items SANEADOS (con sus issues/review_required) tal cual.
function pipeline(rawItems) {
  const server = validarProgramaObservado(rawItems, { ...ENV, zoneNames: ZONAS });
  const observed_state = server.state === 'REVIEW_REQUIRED' ? 'PRESENT_REVIEW_REQUIRED'
    : server.state === 'PASS' ? 'PRESENT_VALID' : 'ABSENT';
  const red = programRequirementsDesdeObservado(server.items);
  const prop = proponerProgramaDesdeObservado(server.items, { linea: 'App LT' });
  return { server, observed_state, red, prop };
}

const base = (o = {}) => ({ kind: 'furniture', quantity: 1, capacity_per_unit: 1, zone: 'OPEN SPACE', confidence: 0.9, evidence: 'dibujado', origin: 'observed', ...o });

describe('INTEGRACIÓN observed pipeline (R10, offline)', () => {
  it('1· reception 2420×830 EXACTA → gobierna, ancla RESOLVED, apply permitido', () => {
    const { red, prop } = pipeline([base({ type: 'recepcion', role: 'reception', zone: 'RECEPCION', dimensions: { w: 2420, d: 830 } })]);
    expect(red.entrada.recepcion).toBe(true);
    expect(prop.anclasConciliadas[0].estado).toBe('RESOLVED');
    expect(prop.requiereRevision).toBe(false);
  });

  it('2· duplicado (issue del servidor) sigue NO gobernable en el cliente', () => {
    const d = base({ type: 'bench', role: 'operational', source_ref: 'B-9', capacity_total: 2, dimensions: { w: 2420, d: 830 } });
    const { server, red } = pipeline([d, { ...d }]);
    expect(server.issues.some((x) => x.code === 'ITEM_DUPLICADO')).toBe(true);
    // ambos quedan en revisión (ninguno gobierna como operativo)
    expect(red.pendientes.some((p) => Array.isArray(p.issues) && p.issues.includes('ITEM_DUPLICADO'))).toBe(true);
  });

  it('3· fuera de envolvente sigue bloqueado tras pasar por el cliente', () => {
    const { red } = pipeline([base({ type: 'bench', role: 'operational', capacity_total: 2, position: { x: 99999, y: 10 } })]);
    expect(red.pendientes.some((p) => Array.isArray(p.issues) && p.issues.includes('POSICION_FUERA_DE_ENVOLVENTE'))).toBe(true);
    expect(red.entrada.operativos).toBe(0);
  });

  it('4· room "recepcion" (kind=room) NO crea ancla ni recepción', () => {
    const { red } = pipeline([base({ kind: 'room', type: 'recepcion', role: 'reception', zone: 'RECEPCION' })]);
    expect(red.gobernables).toBe(0);
    expect(red.entrada.recepcion).toBe(false);
    expect(red.entrada.operativos).toBe(0);
    expect(red.entrada.salas).toEqual([]);
  });

  it('5· bench SIN capacidad NO crea puestos (NEEDS_CAPACITY), pero existe como ancla', () => {
    const { red } = pipeline([base({ type: 'bench', role: 'operational', quantity: 4, capacity_per_unit: undefined, dimensions: { w: 2400, d: 1400 } })]);
    expect(red.entrada.operativos).toBe(0);
    expect(red.pendientes.some((p) => p.code === 'NEEDS_CAPACITY')).toBe(true);
    expect(red.anclasObservadas.length).toBe(1);
  });

  it('6· 4×2 vs capacity_total 12 → CAPACIDAD_INCONSISTENTE → revisión', () => {
    const { server, red } = pipeline([base({ type: 'bench', role: 'operational', quantity: 4, capacity_per_unit: 2, capacity_total: 12, dimensions: { w: 2400, d: 1400 } })]);
    expect(server.items[0].issues).toContain('CAPACIDAD_INCONSISTENTE');
    expect(red.entrada.operativos).toBe(0);
  });

  it('7· B-01 4×2400×1400 NO se convierte en App LT 8U (NEEDS_CONFIRMATION)', () => {
    const { prop } = pipeline([base({ type: 'bench', role: 'operational', quantity: 4, capacity_per_unit: 2, capacity_total: 8, dimensions: { w: 2400, d: 1400 }, source_ref: 'B-01' })]);
    expect(prop.anclasConciliadas[0].estado).toBe('NEEDS_CONFIRMATION');
  });

  it('8· NEEDS_CONFIRMATION deshabilita apply (requiereRevision)', () => {
    const { prop } = pipeline([base({ type: 'bench', role: 'operational', quantity: 4, capacity_per_unit: 2, capacity_total: 8, dimensions: { w: 2400, d: 1400 }, source_ref: 'B-01' })]);
    expect(prop.requiereRevision).toBe(true);
  });

  it('9· CR-01 (credenza) observada NO desaparece → dependiente STORAGE / OBSERVED_ONLY', () => {
    const { red, prop } = pipeline([
      base({ type: 'recepcion', role: 'reception', zone: 'RECEPCION', dimensions: { w: 2420, d: 830 } }),
      base({ type: 'credenza', role: 'storage', zone: 'DIRECCION', source_ref: 'CR-01' }),
    ]);
    expect(red.dependientesObservados.some((d) => d.dependent_role === 'STORAGE')).toBe(true);
    const st = prop.dependientesConciliados.find((d) => d.dependent_role === 'STORAGE');
    expect(st.estado).toBe('OBSERVED_ONLY');
  });

  it('10· S-01/SJ-01 sillas no duplican: no suman puestos ni salas', () => {
    const { red } = pipeline([
      base({ type: 'bench', role: 'operational', quantity: 4, capacity_per_unit: 2, capacity_total: 8, dimensions: { w: 2400, d: 1400 } }),
      base({ type: 'silla operativa', role: 'work_seat', quantity: 8, zone: 'OPEN SPACE' }),
    ]);
    expect(red.entrada.operativos).toBe(8);     // del bench, NO +8 por las sillas
    expect(red.dependientesObservados.filter((d) => d.dependent_role === 'WORK_SEAT')[0].quantity).toBe(8);
  });

  it('11· dos benches sin posición pero con source_ref DISTINTO → NO duplicados', () => {
    const b = (ref) => base({ type: 'bench', role: 'operational', quantity: 4, capacity_per_unit: 2, capacity_total: 8, source_ref: ref });
    const { server } = pipeline([b('B-01'), b('B-02')]);
    expect(server.issues.some((x) => x.code === 'ITEM_DUPLICADO')).toBe(false);
  });

  it('12· confidence baja (0.4) NO gobierna automáticamente → CONFIANZA_BAJA', () => {
    const { red } = pipeline([base({ type: 'recepcion', role: 'reception', zone: 'RECEPCION', dimensions: { w: 2420, d: 830 }, confidence: 0.4 })]);
    expect(red.entrada.recepcion).toBe(false);
    expect(red.pendientes.some((p) => p.code === 'CONFIANZA_BAJA')).toBe(true);
  });

  it('13· QA-COT-01 dims exactas: CR-01 1200×500 y CF-01 3300×600', () => {
    const { server } = pipeline([
      base({ type: 'credenza', role: 'storage', zone: 'DIRECCION', dimensions: { w: 1200, d: 500 }, source_ref: 'CR-01' }),
      base({ kind: 'amenity', type: 'coffee point', role: 'amenity_coffee', zone: 'COFFEE / PRINT', dimensions: { w: 3300, d: 600 }, source_ref: 'CF-01' }),
    ]);
    expect(server.items.find((x) => x.source_ref === 'CR-01').dimensions).toEqual({ w: 1200, d: 500, h: null });
    expect(server.items.find((x) => x.source_ref === 'CF-01').dimensions).toEqual({ w: 3300, d: 600, h: null });
  });
});
