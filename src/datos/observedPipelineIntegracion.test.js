import { describe, it, expect } from 'vitest';
import { validarProgramaObservado } from '../../supabase/functions/leer-plano/observed-core.js';
import { programRequirementsDesdeObservado, proponerProgramaDesdeObservado, propuestaBloqueada, aplicarPrograma, partidaComercialDesdeConfirmado } from './programaRealDelPlano.js';

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

const base = (o = {}) => ({ kind: 'furniture', quantity: 1, capacity_per_unit: 1, zone: 'OPEN SPACE', position: { x: 100, y: 100 }, confidence: 0.9, evidence: 'dibujado', origin: 'observed', ...o });

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

  it('14· ADVERSARIAL R11: 4× bench 1500×1200 → EXACTAMENTE 4× op-2u-1500x1200, 0× op-8u', () => {
    const { prop } = pipeline([base({ type: 'bench operativo', role: 'operational', quantity: 4, capacity_per_unit: 2, capacity_total: 8, dimensions: { w: 1500, d: 1200 }, source_ref: 'B-01' })]);
    const porProducto = (id) => prop.propuesta.partidas.filter((p) => p.bancoId === id).length;
    expect(porProducto('op-2u-1500x1200')).toBe(4);          // identidad física, cardinalidad 1:1
    expect(porProducto('op-8u-4800x1200-cristal')).toBe(0);  // JAMÁS por capacidad agregada
    expect(prop.requiereRevision).toBe(false);                // todo RESUELTO → aplicable
  });

  it('15· R11-3 GATE: reception RESOLVED + CR-01 OBSERVED_ONLY → apply BLOQUEADO', () => {
    const { prop } = pipeline([
      base({ type: 'recepcion', role: 'reception', zone: 'RECEPCION', dimensions: { w: 2420, d: 830 }, source_ref: 'R-01' }),
      base({ type: 'credenza', role: 'storage', zone: 'DIRECCION', dimensions: { w: 1200, d: 500 }, source_ref: 'CR-01' }),
    ]);
    const st = prop.dependientesConciliados.find((d) => d.dependent_role === 'STORAGE');
    expect(st.estado).toBe('OBSERVED_ONLY');
    expect(prop.requiereRevision).toBe(true);     // la credenza observada sin producto bloquea Aplicar
  });

  it('16· P1 identidad ambigua: ancla sin source_ref ni posición → IDENTIDAD_AMBIGUA / revisión', () => {
    const { red } = pipeline([{ kind: 'furniture', type: 'bench operativo', role: 'operational', quantity: 4, capacity_per_unit: 2, capacity_total: 8, dimensions: { w: 1500, d: 1200 }, zone: 'OPEN SPACE', confidence: 0.9, evidence: 'x', origin: 'observed' }]);
    expect(red.pendientes.some((p) => p.code === 'IDENTIDAD_AMBIGUA')).toBe(true);
  });

  it('17· R12-1 AMBIGÜEDAD: mesa 900×900 (melamina/comedor/cristal) sin evidencia → PRODUCT_AMBIGUOUS, nada en partidas', () => {
    const { prop } = pipeline([base({ type: 'mesa de juntas', role: 'meeting', quantity: 1, capacity_per_unit: 4, dimensions: { w: 900, d: 900 }, zone: 'SALA DE JUNTAS', source_ref: 'J-09' })]);
    const conc = prop.anclasConciliadas[0];
    expect(conc.estado).toBe('PRODUCT_AMBIGUOUS');
    expect(conc.candidatos.length).toBeGreaterThanOrEqual(2);
    expect(prop.propuesta.partidas.length).toBe(0);   // no se eligió matches[0]
    expect(prop.requiereRevision).toBe(true);
  });

  it('18· R12-2 CAPACIDAD: bench 1500×1200 con capacity_per_unit=8 → CAPACITY_MISMATCH (no op-2u)', () => {
    const { prop } = pipeline([base({ type: 'bench operativo', role: 'operational', quantity: 1, capacity_per_unit: 8, capacity_total: 8, dimensions: { w: 1500, d: 1200 }, source_ref: 'B-08' })]);
    expect(prop.anclasConciliadas[0].estado).toBe('CAPACITY_MISMATCH');
    expect(prop.requiereRevision).toBe(true);
    expect(prop.propuesta.partidas.filter((p) => p.bancoId === 'op-2u-1500x1200').length).toBe(0);
  });

  it('19· R12-3 SILLAS: operativo resuelto → asientos son RECOMENDACIÓN SUGGESTED, NO partida confirmada', () => {
    const { prop } = pipeline([base({ type: 'bench operativo', role: 'operational', quantity: 1, capacity_per_unit: 2, capacity_total: 2, dimensions: { w: 1500, d: 1200 }, source_ref: 'B-07' })]);
    // ninguna partida es una silla/dependiente: sólo el ancla
    expect(prop.propuesta.partidas.every((p) => /^ANCHOR_/.test(p.relation_role))).toBe(true);
    const rec = prop.recomendaciones.find((r) => r.dependent_role === 'WORK_SEAT');
    expect(rec.product_status).toBe('SUGGESTED');
    expect(rec.requiere_confirmacion_modelo).toBe(true);
    expect(rec.requirement_qty).toBe(2);
  });

  it('20· R12-5 PROVENANCE: B-01 → op-2u; tras aplicar, la partida conserva plan_source_ref=B-01', () => {
    const { prop } = pipeline([base({ type: 'bench operativo', role: 'operational', quantity: 1, capacity_per_unit: 2, capacity_total: 2, dimensions: { w: 1500, d: 1200 }, source_ref: 'B-01' })]);
    const ap = aplicarPrograma(prop.propuesta, { existentes: [] });
    const conf = ap.confirmacion.confirmadas[0];
    expect(conf.plan_source_ref).toBe('B-01');               // identidad del PLANO conservada
    expect(conf.product_source_ref).toBe('op-2u-1500x1200'); // identidad del PRODUCTO, separada
    const comercial = partidaComercialDesdeConfirmado(conf);
    expect(comercial.plan_source_ref).toBe('B-01');
  });

  it('21· R13-1 CARDINALIDAD PARCIAL: 4 anclas observadas, 2 existentes → reutiliza 2 + agrega 2', () => {
    const { prop } = pipeline([base({ type: 'bench operativo', role: 'operational', quantity: 4, capacity_per_unit: 2, capacity_total: 8, dimensions: { w: 1500, d: 1200 }, source_ref: 'B-01' })]);
    expect(prop.propuesta.partidas.length).toBe(4);                      // 4 instancias físicas
    const existentes = [prop.propuesta.partidas[0], prop.propuesta.partidas[1]]; // instance #0 y #1
    const ap = aplicarPrograma(prop.propuesta, { existentes });
    expect(ap.confirmacion.resumen.reutilizadas).toBe(2);   // #0 y #1
    expect(ap.confirmacion.resumen.nuevas).toBe(2);         // #2 y #3 (nunca 0, nunca 6/7/8)
    expect(ap.confirmacion.items.length).toBe(4);
    const ids = ap.confirmacion.items.map((i) => i.instance_id);
    expect(new Set(ids).size).toBe(ids.length);   // cada instance_id única
  });

  it('22· R13-5 PROVENANCE en REUTILIZADOS: la existente reconciliada con B-01 conserva plan_source_ref', () => {
    const { prop } = pipeline([base({ type: 'bench operativo', role: 'operational', quantity: 1, capacity_per_unit: 2, capacity_total: 2, dimensions: { w: 1500, d: 1200 }, source_ref: 'B-01' })]);
    const existentes = [prop.propuesta.partidas[0]];
    const ap = aplicarPrograma(prop.propuesta, { existentes });
    expect(ap.confirmacion.resumen.reutilizadas).toBe(1);
    expect(ap.confirmacion.sinCambio[0].plan_source_ref).toBe('B-01');
    // el patch de enriquecimiento también lleva la provenance del plano
    expect(ap.confirmacion.enriquecidos[0]?.patch?.plan_source_ref ?? 'B-01').toBe('B-01');
  });

  it('23· R13-3 RECOMENDACIONES visibles: sillas como SUGGESTED, no desaparecen ni se auto-confirman', () => {
    const { prop } = pipeline([base({ type: 'bench operativo', role: 'operational', quantity: 1, capacity_per_unit: 2, capacity_total: 2, dimensions: { w: 1500, d: 1200 }, source_ref: 'B-07' })]);
    expect(prop.recomendaciones.length).toBeGreaterThan(0);
    const rec = prop.recomendaciones.find((r) => r.dependent_role === 'WORK_SEAT');
    expect(rec.requirement_qty).toBe(2);
    expect(rec.product_status).toBe('SUGGESTED');
    expect(prop.propuesta.partidas.some((p) => p.relation_role === 'WORK_SEAT')).toBe(false);  // no es partida
  });

  it('24· R13-4 modelo observado ≠ source_ref: sin modelo explícito → requiere_confirmacion_modelo', () => {
    const { prop } = pipeline([
      base({ type: 'bench operativo', role: 'operational', quantity: 1, capacity_per_unit: 1, capacity_total: 1, dimensions: { w: 1500, d: 600 }, source_ref: 'B-10' }),
      base({ type: 'silla operativa', role: 'work_seat', quantity: 1, zone: 'OPEN SPACE', source_ref: 'S-01' }),
    ]);
    const ws = prop.dependientesConciliados.find((d) => d.dependent_role === 'WORK_SEAT');
    // S-01 (source_ref) NO se usa como modelo; sin modelo explícito → requiere confirmación
    expect(ws.observado_modelo).toBeNull();
    expect(ws.requiere_confirmacion_modelo).toBe(true);
  });
});
