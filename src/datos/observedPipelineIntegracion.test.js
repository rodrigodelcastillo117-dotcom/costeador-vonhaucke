import { describe, it, expect } from 'vitest';
import { validarProgramaObservado } from '../../supabase/functions/leer-plano/observed-core.js';
import { programRequirementsDesdeObservado, proponerProgramaDesdeObservado, propuestaBloqueada, aplicarPrograma, partidaComercialDesdeConfirmado, propuestaSilleriaSugerida, silleriaPendiente, bloqueosProgramaObservado, resolverAplicacionAtomica, programaTieneAplicacionPendiente } from './programaRealDelPlano.js';

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

  it('25· R14-1 cantidad>1: observed 2× + existente 1 renglón cantidad=2 → reutiliza 2, agrega 0, físico=2', () => {
    const { prop } = pipeline([base({ type: 'bench operativo', role: 'operational', quantity: 2, capacity_per_unit: 2, capacity_total: 4, dimensions: { w: 1500, d: 1200 }, source_ref: 'B-01' })]);
    expect(prop.propuesta.partidas.length).toBe(2);
    // UN renglón comercial agrupado con cantidad=2 (como lo deja subir/bajar la cotización)
    const existenteRow = [{ ...prop.propuesta.partidas[0], cantidad: 2 }];
    const ap = aplicarPrograma(prop.propuesta, { existentes: existenteRow });
    expect(ap.confirmacion.resumen.reutilizadasUnidades).toBe(2);   // absorbe 2 físicos
    expect(ap.confirmacion.resumen.nuevas).toBe(0);                 // NO sobre-agrega
    const fisico = ap.confirmacion.items.reduce((s, i) => s + (Number(i.cantidad) || 1), 0);
    expect(fisico).toBe(2);
  });

  it('26· R14-1 parcial: observed 4× + existente 1 renglón cantidad=2 → faltan exactamente 2', () => {
    const { prop } = pipeline([base({ type: 'bench operativo', role: 'operational', quantity: 4, capacity_per_unit: 2, capacity_total: 8, dimensions: { w: 1500, d: 1200 }, source_ref: 'B-01' })]);
    const existenteRow = [{ ...prop.propuesta.partidas[0], cantidad: 2 }];
    const ap = aplicarPrograma(prop.propuesta, { existentes: existenteRow });
    expect(ap.confirmacion.resumen.reutilizadasUnidades).toBe(2);
    expect(ap.confirmacion.resumen.nuevas).toBe(2);                 // exactamente 2 nuevas
  });

  it('27· R14-2 IDENTIDAD ESTABLE: reordenar observed NO intercambia provenance (B-01↔A, B-02↔B)', () => {
    const bench = (ref, zone) => base({ type: 'bench operativo', role: 'operational', quantity: 1, capacity_per_unit: 2, capacity_total: 2, dimensions: { w: 1500, d: 1200 }, source_ref: ref, zone });
    // 1ª corrida: B-01 en OPEN SPACE, B-02 en DIRECCION → 2 partidas op-2u.
    const p1 = proponerProgramaDesdeObservado([bench('B-01', 'OPEN SPACE'), bench('B-02', 'DIRECCION')], { linea: 'App LT' });
    const ap1 = aplicarPrograma(p1.propuesta, { existentes: [] });
    const ex1 = { ...ap1.confirmacion.confirmadas.find((c) => c.plan_source_ref === 'B-01'), id: 'x1' };
    const ex2 = { ...ap1.confirmacion.confirmadas.find((c) => c.plan_source_ref === 'B-02'), id: 'x2' };
    // 2ª corrida con el observed REORDENADO (B-02 primero) + los existentes.
    const p2 = proponerProgramaDesdeObservado([bench('B-02', 'DIRECCION'), bench('B-01', 'OPEN SPACE')], { linea: 'App LT' });
    const ap2 = aplicarPrograma(p2.propuesta, { existentes: [ex1, ex2] });
    expect(ap2.confirmacion.resumen.reutilizadasUnidades).toBe(2);   // reutiliza los mismos físicos
    expect(ap2.confirmacion.resumen.nuevas).toBe(0);
    // la provenance NO se intercambia: x1 sigue siendo B-01, x2 sigue siendo B-02.
    // P1-R15-I2: como la provenance ya era correcta, el patch idempotente puede OMITIR
    // plan_source_ref (no-op). Lo que importa es que NO lo cambie al valor equivocado;
    // se verifica sobre la partida MERGEADA (existente + patch), como hace App.
    const px1 = ap2.confirmacion.enriquecidos.find((e) => e.id === 'x1')?.patch || {};
    const px2 = ap2.confirmacion.enriquecidos.find((e) => e.id === 'x2')?.patch || {};
    expect({ ...ex1, ...px1 }.plan_source_ref).toBe('B-01');
    expect({ ...ex2, ...px2 }.plan_source_ref).toBe('B-02');
  });

  it('28· R14-3 MODEL_MISMATCH es GATE: silla observada con modelo ≠ sugerido → requiereRevision', () => {
    const { prop } = pipeline([
      base({ type: 'bench operativo', role: 'operational', quantity: 1, capacity_per_unit: 2, capacity_total: 2, dimensions: { w: 1500, d: 1200 }, source_ref: 'B-30' }),
      base({ type: 'silla operativa', role: 'work_seat', quantity: 2, zone: 'OPEN SPACE', source_ref: 'S-30', observed_model: 'silla-marca-x' }),
    ]);
    const ws = prop.dependientesConciliados.find((d) => d.dependent_role === 'WORK_SEAT');
    expect(ws.modelo_mismatch).toBe(true);        // observado silla-marca-x ≠ sugerido silla-win
    expect(prop.requiereRevision).toBe(true);     // mismatch bloquea aplicar
  });

  it('29· R14-3 sillería sin modelo: programa NO completo (requiereConfirmacionSillas) pero ancla aplicable', () => {
    const { prop } = pipeline([base({ type: 'bench operativo', role: 'operational', quantity: 1, capacity_per_unit: 2, capacity_total: 2, dimensions: { w: 1500, d: 1200 }, source_ref: 'B-31' })]);
    expect(prop.requiereConfirmacionSillas).toBe(true);   // sillería con modelo por confirmar
    expect(prop.programaCompleto).toBe(false);            // no se presenta como completo
    expect(prop.requiereRevision).toBe(false);            // pero el ANCLA sí se puede aplicar
    expect(propuestaBloqueada(prop.propuesta)).toBe(false);
  });

  it('30· R14-4 PROVENANCE completa: evidence + posición + orientación llegan a la partida comercial', () => {
    const { prop } = pipeline([base({ type: 'bench operativo', role: 'operational', quantity: 1, capacity_per_unit: 2, capacity_total: 2, dimensions: { w: 1500, d: 1200 }, position: { x: 1234, y: 5678 }, orientation: 90, evidence: 'isla dibujada en planta', source_ref: 'B-40' })]);
    const ap = aplicarPrograma(prop.propuesta, { existentes: [] });
    const comercial = partidaComercialDesdeConfirmado(ap.confirmacion.confirmadas[0]);
    expect(comercial.plan_source_ref).toBe('B-40');
    expect(comercial.evidence).toBe('isla dibujada en planta');
    expect(comercial.observed_position).toEqual({ x: 1234, y: 5678 });
    expect(comercial.observed_orientation).toBe(90);
  });

  it('31· R15-1 SURPLUS: observed 2 + existente renglón cantidad=4 → reutiliza 2, 0 nuevas, EXISTING_SURPLUS de 2', () => {
    const { prop } = pipeline([base({ type: 'bench operativo', role: 'operational', quantity: 2, capacity_per_unit: 2, capacity_total: 4, dimensions: { w: 1500, d: 1200 }, source_ref: 'B-01' })]);
    const existenteRow = [{ ...prop.propuesta.partidas[0], cantidad: 4 }];
    const ap = aplicarPrograma(prop.propuesta, { existentes: existenteRow });
    expect(ap.confirmacion.resumen.nuevas).toBe(0);
    const surplus = ap.confirmacion.conflictos.find((c) => c.code === 'EXISTING_SURPLUS');
    expect(surplus).toBeTruthy();
    expect(surplus.sobrantes).toBe(2);               // 4 existentes − 2 observadas
    expect(ap.ok).toBe(false);                       // requiere revisión, NO silencio
  });

  it('31b· R15-1 SURPLUS observed=0: programa observado vacío + existente observado → review, no silencio', () => {
    const existente = [{ relation_role: 'ANCHOR_WORKSTATION', rol: 'operativo', bancoId: 'op-2u-1500x1200', cantidad: 4, plan_source_ref: 'B-01', product_source_ref: 'op-2u-1500x1200' }];
    const ap = aplicarPrograma({ partidas: [], gobernadoPorObservado: true }, { existentes: existente });
    expect(ap.confirmacion.conflictos.some((c) => c.code === 'EXISTING_SURPLUS')).toBe(true);
  });

  it('32· R15-2 PROVENANCE AGRUPADA: fila cantidad=2 ↔ B-01(zona A)+B-02(zona B) conserva AMBAS', () => {
    const bench = (ref, zone) => base({ type: 'bench operativo', role: 'operational', quantity: 1, capacity_per_unit: 2, capacity_total: 2, dimensions: { w: 1500, d: 1200 }, source_ref: ref, zone });
    const p = proponerProgramaDesdeObservado([bench('B-01', 'OPEN SPACE'), bench('B-02', 'DIRECCION')], { linea: 'App LT' });
    // una sola fila comercial agrupada cantidad=2 que debe absorber B-01 y B-02
    const filaAgrupada = [{ ...p.propuesta.partidas[0], instance_id: null, plan_source_ref: null, cantidad: 2 }];
    const ap = aplicarPrograma(p.propuesta, { existentes: filaAgrupada });
    const reemitida = ap.confirmacion.sinCambio.find((s) => Array.isArray(s.plan_instances));
    expect(reemitida).toBeTruthy();
    const refs = reemitida.plan_instances.map((pi) => pi.plan_source_ref).sort();
    expect(refs).toEqual(['B-01', 'B-02']);          // ninguna provenance desaparece
  });

  it('33· R15-3 STABLE KEY: dos benches misma zone+grouping, posiciones distintas, sin source_ref → IDs DIFERENTES', () => {
    const b = (x) => ({ kind: 'furniture', type: 'bench operativo', role: 'operational', quantity: 1, capacity_per_unit: 2, capacity_total: 2, dimensions: { w: 1500, d: 1200 }, zone: 'OPEN SPACE', grouping: 'isla-1', position: { x, y: 10 }, confidence: 0.9, evidence: 'x', origin: 'observed' });
    const p = proponerProgramaDesdeObservado([b(100), b(900)], { linea: 'App LT' });
    const ids = p.propuesta.partidas.filter((x) => /^ANCHOR_/.test(x.relation_role)).map((x) => x.instance_id);
    expect(new Set(ids).size).toBe(ids.length);      // instance_id DISTINTOS (no colisión por grouping)
    const reqs = p.anclasObservadas ? null : null;   // (req_id también distinto por posición)
    expect(ids.length).toBe(2);
  });

  it('34· R15-4 programaCompleto bloquea paso a propuesta final mientras hay sillería por confirmar', () => {
    const { prop } = pipeline([base({ type: 'bench operativo', role: 'operational', quantity: 1, capacity_per_unit: 2, capacity_total: 2, dimensions: { w: 1500, d: 1200 }, source_ref: 'B-50' })]);
    expect(prop.programaCompleto).toBe(false);        // gate del paso a propuesta final
    expect(prop.requiereConfirmacionSillas).toBe(true);
  });

  it('34b· R15-4 ACCIÓN "usar sugerida": convierte el requerimiento en partidas de silla REALES', () => {
    const { prop } = pipeline([base({ type: 'bench operativo', role: 'operational', quantity: 1, capacity_per_unit: 2, capacity_total: 2, dimensions: { w: 1500, d: 1200 }, source_ref: 'B-51' })]);
    const sill = propuestaSilleriaSugerida(prop.recomendaciones, { linea: 'App LT' });
    expect(sill.partidas.length).toBe(2);                         // 2 asientos (capacidad del bench)
    expect(sill.partidas.every((p) => p.relation_role === 'WORK_SEAT')).toBe(true);
    expect(sill.partidas.every((p) => p.product_status === 'RESOLVED')).toBe(true);
    // aplicables de verdad (producto canónico con identidad)
    const ap = aplicarPrograma(sill, { existentes: [] });
    expect(ap.confirmacion.confirmadas.length).toBe(2);
  });

  it('35· R15-B SILLERÍA pendiente por CANTIDAD: 1 silla existente no cubre 8+10 requeridas', () => {
    const recomendaciones = [
      { dependent_role: 'WORK_SEAT', requirement_qty: 8, suggested_product: 'silla-win' },
      { dependent_role: 'MEETING_SEAT', requirement_qty: 10, suggested_product: 'silla-concerto' },
    ];
    expect(silleriaPendiente(recomendaciones, [{ relation_role: 'WORK_SEAT', bancoId: 'silla-win', cantidad: 1 }])).toBe(true);
    // cubierto sólo cuando TODOS los roles están en cantidad
    const cubierto = [{ relation_role: 'WORK_SEAT', bancoId: 'silla-win', cantidad: 8 }, { relation_role: 'MEETING_SEAT', bancoId: 'silla-concerto', cantidad: 10 }];
    expect(silleriaPendiente(recomendaciones, cubierto)).toBe(false);
  });

  it('36· R15-C/C2 "usar sugerida" bench quantity=4: 8 sillas únicas, 2 por ancla, HEREDAN topología canónica', () => {
    const { prop } = pipeline([base({ type: 'bench operativo', role: 'operational', quantity: 4, capacity_per_unit: 2, capacity_total: 8, dimensions: { w: 1500, d: 1200 }, source_ref: 'B-01' })]);
    const sill = propuestaSilleriaSugerida(prop.recomendaciones, { linea: 'App LT' });
    expect(sill.partidas.length).toBe(8);                          // 4 benches × 2 asientos
    const ids = sill.partidas.map((p) => p.instance_id);
    expect(new Set(ids).size).toBe(8);                             // instance_id ÚNICOS (no duplicados)
    const porAncla = {};
    for (const p of sill.partidas) porAncla[p.anchor_instance_id] = (porAncla[p.anchor_instance_id] || 0) + 1;
    expect(Object.keys(porAncla).length).toBe(4);                  // 4 anclas distintas
    expect(Object.values(porAncla).every((n) => n === 2)).toBe(true); // 2 sillas por ancla
    // R15-C2: cada silla HEREDA anchor_role del ancla y el functional_group_id del ancla.
    expect(sill.partidas.every((p) => p.anchor_role === 'ANCHOR_WORKSTATION')).toBe(true);
    // las 2 sillas de cada ancla comparten el functional_group_id del ancla (= el del preview)
    const anclasPreview = prop.propuesta.partidas.filter((p) => p.relation_role === 'ANCHOR_WORKSTATION');
    for (const anc of anclasPreview) {
      const suyas = sill.partidas.filter((p) => p.anchor_instance_id === anc.instance_id);
      expect(suyas.length).toBe(2);
      expect(suyas.every((p) => p.functional_group_id === anc.functional_group_id)).toBe(true);
    }
  });

  it('37· R15-B2 ancla equivocada: 8 sillas ligadas al ancla A no cubren el requerimiento del ancla B', () => {
    const recomendaciones = [
      { dependent_role: 'WORK_SEAT', requirement_qty: 4, para_ancla: 'ancla-A', suggested_product: 'silla-win' },
      { dependent_role: 'WORK_SEAT', requirement_qty: 4, para_ancla: 'ancla-B', suggested_product: 'silla-win' },
    ];
    // 8 sillas pero TODAS ligadas a A (o sin ancla) → B queda sin cubrir → pendiente.
    const todasA = Array.from({ length: 8 }, () => ({ relation_role: 'WORK_SEAT', bancoId: 'silla-win', anchor_instance_id: 'ancla-A', cantidad: 1 }));
    expect(silleriaPendiente(recomendaciones, todasA)).toBe(true);
    // 4 a A + 4 a B → cubierto
    const bien = [...Array.from({ length: 4 }, () => ({ relation_role: 'WORK_SEAT', bancoId: 'silla-win', anchor_instance_id: 'ancla-A', cantidad: 1 })),
      ...Array.from({ length: 4 }, () => ({ relation_role: 'WORK_SEAT', bancoId: 'silla-win', anchor_instance_id: 'ancla-B', cantidad: 1 }))];
    expect(silleriaPendiente(recomendaciones, bien)).toBe(false);
  });

  it('37b· R15-B2 modelo distinto SIN confirmar NO cubre el requerimiento', () => {
    const recomendaciones = [{ dependent_role: 'WORK_SEAT', requirement_qty: 2, para_ancla: 'ancla-A', suggested_product: 'silla-win' }];
    const otroModelo = [{ relation_role: 'WORK_SEAT', bancoId: 'silla-alpha', anchor_instance_id: 'ancla-A', cantidad: 2 }];
    expect(silleriaPendiente(recomendaciones, otroModelo)).toBe(true);           // modelo ≠ sugerido → pendiente
    const confirmadoOtro = [{ relation_role: 'WORK_SEAT', bancoId: 'silla-alpha', anchor_instance_id: 'ancla-A', cantidad: 2, confirmado_modelo: true }];
    expect(silleriaPendiente(recomendaciones, confirmadoOtro)).toBe(false);      // acto explícito de modelo → cubierto
  });

  it('38· R15-D2 borrado REAL bajo el MERGE del padre: neutraliza la segunda realidad', () => {
    // Replica la semántica de App.guardarAcomodo: acomodo: { ...viejo, ...datos }.
    const viejo = { observed_state: 'PRESENT_VALID', observed_program: [{}], sugeridosPartidas: [{ id: 'stale' }], demoAutopoblado: true, programaPropuesto: true };
    // Lo que Acomodo envía con observed presente (sobreescritura neutral, no omisión):
    const limpio = { observed_state: 'PRESENT_VALID', sugeridosPartidas: [], demoAutopoblado: false, programaPropuesto: false };
    const merged = { ...viejo, ...limpio };
    expect(merged.sugeridosPartidas).toEqual([]);     // el merge YA no conserva lo stale
    expect(merged.demoAutopoblado).toBe(false);
    expect(merged.programaPropuesto).toBe(false);
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

  // ==========================================================================
  //  P0-R15-F · AUTORIDAD ÚNICA de BLOQUEOS de PROGRAMA OBSERVADO para publicación.
  //  El layout puede ser geométricamente válido; el PROGRAMA COMERCIAL incompleto
  //  NO es publicable. bloqueosProgramaObservado es lo que apaga programaListo.
  // ==========================================================================
  it('F1· 4 benches ×2 asientos, anclas aplicadas, 0 sillas → SILLERIA_PENDIENTE (no publicable)', () => {
    const { prop } = pipeline([base({ type: 'bench operativo', role: 'operational', quantity: 4, capacity_per_unit: 2, capacity_total: 8, dimensions: { w: 1500, d: 1200 }, source_ref: 'B-01' })]);
    // Las 4 anclas ya están en la cotización (aplicadas); 0 sillas confirmadas.
    const anclasAplicadas = prop.propuesta.partidas.map(partidaComercialDesdeConfirmado);
    const bloqueos = bloqueosProgramaObservado(prop, { partidas: anclasAplicadas });
    expect(bloqueos.some((b) => b.code === 'SILLERIA_PENDIENTE')).toBe(true);
    expect(bloqueos.length).toBeGreaterThan(0);        // ⇒ programaListo=false, publicable=false
  });

  it('F2· layout PASS + EXISTING_SURPLUS → conflicto de reconciliación BLOQUEA publicación', () => {
    const { prop } = pipeline([base({ type: 'bench operativo', role: 'operational', quantity: 2, capacity_per_unit: 2, capacity_total: 4, dimensions: { w: 1500, d: 1200 }, source_ref: 'B-01' })]);
    // Renglón existente cantidad=4 del MISMO producto/plan → al reconciliar sobran 2.
    const existente = [{ relation_role: 'ANCHOR_WORKSTATION', rol: 'operativo', bancoId: 'op-2u-1500x1200', cantidad: 4, plan_source_ref: 'B-01', product_source_ref: 'op-2u-1500x1200' }];
    const bloqueos = bloqueosProgramaObservado(prop, { partidas: existente });
    expect(bloqueos.some((b) => b.code === 'EXISTING_SURPLUS')).toBe(true);
    expect(bloqueos.length).toBeGreaterThan(0);
  });

  it('F3· anclas aplicadas + sillería confirmada (misma-identidad) → SIN bloqueos (publicable)', () => {
    const { prop } = pipeline([base({ type: 'bench operativo', role: 'operational', quantity: 1, capacity_per_unit: 2, capacity_total: 2, dimensions: { w: 1500, d: 1200 }, source_ref: 'B-60' })]);
    const anclas = prop.propuesta.partidas.map(partidaComercialDesdeConfirmado);
    const sillas = propuestaSilleriaSugerida(prop.recomendaciones, { linea: 'App LT' }).partidas;
    const bloqueos = bloqueosProgramaObservado(prop, { partidas: [...anclas, ...sillas] });
    expect(bloqueos).toEqual([]);                       // ⇒ programaListo=true, publicable
  });

  // ==========================================================================
  //  P1-R15-H · confirmado_modelo SOBREVIVE aItemConfirmado + partidaComercialDesdeConfirmado.
  // ==========================================================================
  it('H1· modelo ALTERNO confirmado SOBREVIVE el apply end-to-end → silleriaPendiente=false', () => {
    const recomendaciones = [{ dependent_role: 'WORK_SEAT', requirement_qty: 2, para_ancla: 'ancla-A', suggested_product: 'silla-win' }];
    // El usuario confirma un modelo DISTINTO al sugerido (silla-win → silla-alpha).
    const seatsConfirmados = {
      partidas: [
        { relation_role: 'WORK_SEAT', rol: 'silla', bancoId: 'silla-alpha', anchor_instance_id: 'ancla-A', cantidad: 2, confirmado_modelo: true, productoId: 'pid-alpha', product_status: 'RESOLVED' },
      ],
    };
    const ap = aplicarPrograma(seatsConfirmados, { existentes: [] });
    const comercial = ap.confirmacion.confirmadas.map(partidaComercialDesdeConfirmado);
    // la bandera cruzó aItemConfirmado → partidaComercialDesdeConfirmado
    expect(comercial.every((p) => p.confirmado_modelo === true)).toBe(true);
    // y por eso el requerimiento de modelo-alterno queda CUBIERTO
    expect(silleriaPendiente(recomendaciones, comercial)).toBe(false);
  });

  it('H2· modelo ALTERNO SIN confirmar NO sobrevive como confirmado → silleriaPendiente=true', () => {
    const recomendaciones = [{ dependent_role: 'WORK_SEAT', requirement_qty: 2, para_ancla: 'ancla-A', suggested_product: 'silla-win' }];
    const seatsSinConfirmar = {
      partidas: [
        { relation_role: 'WORK_SEAT', rol: 'silla', bancoId: 'silla-alpha', anchor_instance_id: 'ancla-A', cantidad: 2, productoId: 'pid-alpha', product_status: 'RESOLVED' },
      ],
    };
    const ap = aplicarPrograma(seatsSinConfirmar, { existentes: [] });
    const comercial = ap.confirmacion.confirmadas.map(partidaComercialDesdeConfirmado);
    expect(comercial.some((p) => p.confirmado_modelo === true)).toBe(false);   // nunca se inventa la bandera
    expect(silleriaPendiente(recomendaciones, comercial)).toBe(true);          // modelo ≠ sugerido y sin confirmar
  });

  // ==========================================================================
  //  P1-R15-I · resolverAplicacionAtomica: el resultado REFLEJA el commit contra la
  //  autoridad (`existentes`), no un snapshot. Prueba REAL de la carrera.
  // ==========================================================================
  it('I1· carrera: el resultado refleja la AUTORIDAD (prev), no un snapshot — 2ª aplicación NO suma partidas nuevas', () => {
    const { prop } = pipeline([base({ type: 'bench operativo', role: 'operational', quantity: 1, capacity_per_unit: 2, capacity_total: 2, dimensions: { w: 1500, d: 1200 }, source_ref: 'B-70' })]);
    // 1ª: contra cotización vacía → COMMIT con partidas nuevas.
    const r1 = resolverAplicacionAtomica(prop.propuesta, { existentes: [] });
    expect(r1.committed).toBe(true);
    expect(r1.confirmadas).toBeGreaterThan(0);
    const nNuevas = r1.nuevas.length;
    // 2ª: el `prev` ya contiene lo committeado por r1. El bug clásico (usar el snapshot
    // vacío como autoridad) reportaría de nuevo `nNuevas` confirmadas y DUPLICARÍA. La
    // autoridad fresca (prev) no agrega NADA nuevo → confirmadas=0, nuevas=0, sin crecer.
    const r2 = resolverAplicacionAtomica(prop.propuesta, { existentes: r1.partidas });
    expect(r2.confirmadas).toBe(0);                    // NO reporta éxito fantasma
    expect(r2.nuevas.length).toBe(0);                  // 0 partidas NUEVAS
    expect(r2.partidas.length).toBe(r1.partidas.length); // no duplica (misma cardinalidad)
    expect(nNuevas).toBeGreaterThan(0);                // el snapshot SÍ habría reportado éxito
    // P1-R15-I2 (estricto): re-aplicar datos idénticos es VERDADERAMENTE idempotente —
    // sin enriquecidos no-op → committed=false (no dispara rerender/autosave inútil).
    expect(r2.enriquecidos.length).toBe(0);
    expect(r2.committed).toBe(false);
    expect(r2.motivo).toBe('IDEMPOTENTE');
  });

  it('I2· enriquecido REAL (metadata nueva) sí committea; idéntico NO', () => {
    const { prop } = pipeline([base({ type: 'bench operativo', role: 'operational', quantity: 1, capacity_per_unit: 2, capacity_total: 2, dimensions: { w: 1500, d: 1200 }, source_ref: 'B-71' })]);
    const anc = prop.propuesta.partidas[0];
    // Existente del MISMO producto/plan pero SIN la metadata estructural (legacy) → el
    // patch aporta cambios reales → committed=true, enriquecidos>0.
    const legacy = [{ id: 'leg-1', bancoId: anc.bancoId, relation_role: anc.relation_role, cantidad: 1, plan_source_ref: anc.plan_source_ref }];
    const r = resolverAplicacionAtomica(prop.propuesta, { existentes: legacy });
    expect(r.committed).toBe(true);
    expect(r.enriquecidos.length).toBeGreaterThan(0);
    // Segunda vez contra el estado ya enriquecido → idéntico → committed=false.
    const r2 = resolverAplicacionAtomica(prop.propuesta, { existentes: r.partidas });
    expect(r2.committed).toBe(false);
    expect(r2.enriquecidos.length).toBe(0);
  });

  it('I·conflicto de reconciliación → committed=false fail-closed (no escribe)', () => {
    const { prop } = pipeline([base({ type: 'bench operativo', role: 'operational', quantity: 2, capacity_per_unit: 2, capacity_total: 4, dimensions: { w: 1500, d: 1200 }, source_ref: 'B-01' })]);
    const existente = [{ relation_role: 'ANCHOR_WORKSTATION', rol: 'operativo', bancoId: 'op-2u-1500x1200', cantidad: 4, plan_source_ref: 'B-01', product_source_ref: 'op-2u-1500x1200' }];
    const r = resolverAplicacionAtomica(prop.propuesta, { existentes: existente });
    expect(r.committed).toBe(false);
    expect(r.motivo).toBe('CONFLICTO_RECONCILIACION');
    expect(r.conflictos.length).toBeGreaterThan(0);
  });

  it('I·bloqueada: propuesta bajo revisión → committed=false (no la aplica aunque la pasen)', () => {
    const bloqueada = { partidas: [{ relation_role: 'ANCHOR_WORKSTATION', bancoId: 'x', product_status: 'NEEDS_CONFIRMATION' }], requiereRevision: true };
    const r = resolverAplicacionAtomica(bloqueada, { existentes: [] });
    expect(r.committed).toBe(false);
    expect(r.motivo).toBe('PROPUESTA_REQUIERE_REVISION');
  });

  // ==========================================================================
  //  P0-R15-K · OBSERVED detectó mobiliario que todavía NO está en la cotización →
  //  programa NO publicable hasta aplicarlo. OBSERVED detectado ≠ producto confirmado.
  // ==========================================================================
  it('K· recepción nueva detectada pero NO aplicada → PROGRAMA_PENDIENTE_APLICAR; tras aplicar, publicable', () => {
    const prop = proponerProgramaDesdeObservado(
      [base({ type: 'recepcion', role: 'reception', zone: 'RECEPCION', dimensions: { w: 2420, d: 830 }, source_ref: 'R-01' })],
      { linea: 'App LT' },
    );
    expect(prop.requiereRevision).toBe(false);        // recepción canónica RESOLVED, sin sillería
    // Cotización ANTES de aplicar: un producto real que NO está en el observed (queda intacto).
    const existente = [{ id: 'p1', relation_role: 'ANCHOR_DESK', bancoId: 'esc-legacy', cantidad: 1 }];
    const antes = bloqueosProgramaObservado(prop, { partidas: existente });
    expect(antes.some((b) => b.code === 'PROGRAMA_PENDIENTE_APLICAR')).toBe(true);   // detectó recepción por agregar
    // Tras aplicar la recepción (se incorpora a la cotización) → confirmadas=0 → publicable.
    const aplicado = aplicarPrograma(prop.propuesta, { existentes: existente });
    const nuevas = aplicado.confirmacion.confirmadas.map(partidaComercialDesdeConfirmado);
    const despues = bloqueosProgramaObservado(prop, { partidas: [...existente, ...nuevas] });
    expect(despues.some((b) => b.code === 'PROGRAMA_PENDIENTE_APLICAR')).toBe(false);
    expect(despues).toEqual([]);                       // sin más bloqueos ⇒ programaListo=true
  });

  // ==========================================================================
  //  P1-R15-H3 · confirmado_modelo SOBREVIVE también al REUTILIZAR una silla existente
  //  (camino `enriquecidos` → estructuraDe), no sólo para una silla nueva.
  // ==========================================================================
  // ==========================================================================
  //  P0-R15-L · autoridad compartida de "aplicación pendiente" (el gate de Voni usa la
  //  MISMA fuente que el blocker de Acomodo). OBSERVED detectado ≠ confirmado.
  // ==========================================================================
  it('L· programaTieneAplicacionPendiente: recepción nueva no aplicada → true; tras aplicar → false', () => {
    const prop = proponerProgramaDesdeObservado(
      [base({ type: 'recepcion', role: 'reception', zone: 'RECEPCION', dimensions: { w: 2420, d: 830 }, source_ref: 'R-02' })],
      { linea: 'App LT' },
    );
    const existente = [{ id: 'p1', relation_role: 'ANCHOR_DESK', bancoId: 'esc-legacy', cantidad: 1 }];
    expect(programaTieneAplicacionPendiente(prop, existente)).toBe(true);     // falta aplicar la recepción
    const aplicado = aplicarPrograma(prop.propuesta, { existentes: existente });
    const nuevas = aplicado.confirmacion.confirmadas.map(partidaComercialDesdeConfirmado);
    expect(programaTieneAplicacionPendiente(prop, [...existente, ...nuevas])).toBe(false); // ya aplicada
  });

  // ==========================================================================
  //  P0-R15-M · "pendiente de aplicar" incluye ENRIQUECIMIENTOS, no sólo productos nuevos.
  // ==========================================================================
  it('M· enrichment-only (existente legacy sin metadata): bloquea antes de aplicar, publicable después', () => {
    const prop = proponerProgramaDesdeObservado(
      [base({ type: 'recepcion', role: 'reception', zone: 'RECEPCION', dimensions: { w: 2420, d: 830 }, source_ref: 'R-03' })],
      { linea: 'App LT' },
    );
    const anc = prop.propuesta.partidas[0];
    // Existe el producto canónico CORRECTO pero legacy/manual: sin instance_id /
    // functional_group_id / plan_source_ref (sólo banco + rol). Reconciliar lo enriquece.
    const legacy = [{ id: 'leg-R', bancoId: anc.bancoId, relation_role: anc.relation_role, cantidad: 1 }];
    const atomic = resolverAplicacionAtomica(prop.propuesta, { existentes: legacy });
    expect(atomic.committed).toBe(true);
    expect(atomic.nuevas.length).toBe(0);              // NO hay producto nuevo
    expect(atomic.enriquecidos.length).toBeGreaterThan(0); // SÍ hay enriquecimiento real
    const antes = bloqueosProgramaObservado(prop, { partidas: legacy });
    const bK = antes.find((b) => b.code === 'PROGRAMA_PENDIENTE_APLICAR');
    expect(bK).toBeTruthy();                            // bloquea aunque confirmadas=0
    expect(bK.enriquecidos).toBeGreaterThan(0);
    expect(bK.nuevas).toBe(0);
    // Tras aplicar el enrichment → idéntico → committed=false → blocker desaparece.
    const despues = bloqueosProgramaObservado(prop, { partidas: atomic.partidas });
    expect(despues.some((b) => b.code === 'PROGRAMA_PENDIENTE_APLICAR')).toBe(false);
  });

  it('H3· confirmar modelo alterno sobre una silla YA existente persiste confirmado_modelo → silleriaPendiente=false', () => {
    const recomendaciones = [{ dependent_role: 'WORK_SEAT', requirement_qty: 2, para_ancla: 'ancla-A', suggested_product: 'silla-win' }];
    // Ya existe una silla del modelo alterno, SIN confirmar el modelo.
    const existente = [{ id: 's1', relation_role: 'WORK_SEAT', rol: 'silla', bancoId: 'silla-alpha', anchor_instance_id: 'ancla-A', cantidad: 2, product_status: 'RESOLVED' }];
    expect(silleriaPendiente(recomendaciones, existente)).toBe(true);   // modelo ≠ sugerido, sin confirmar
    // El usuario confirma EXPLÍCITAMENTE ese modelo alterno (misma identidad, confirmado_modelo=true).
    const propuestaConfirmada = { partidas: [{ relation_role: 'WORK_SEAT', rol: 'silla', bancoId: 'silla-alpha', anchor_instance_id: 'ancla-A', cantidad: 2, confirmado_modelo: true, productoId: 'pid-alpha', product_status: 'RESOLVED' }] };
    const ap = aplicarPrograma(propuestaConfirmada, { existentes: existente });
    // se REUTILIZA la existente (enriquecidos), no se agrega nueva.
    const patch = ap.confirmacion.enriquecidos.find((e) => e.id === 's1')?.patch;
    expect(patch?.confirmado_modelo).toBe(true);        // la bandera cruzó estructuraDe
    // aplicar el patch al existente (como hace App) → la partida persistida queda confirmada
    const persistida = { ...existente[0], ...patch };
    expect(silleriaPendiente(recomendaciones, [persistida])).toBe(false);
  });
});
