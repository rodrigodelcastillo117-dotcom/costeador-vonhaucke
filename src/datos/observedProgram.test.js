import { describe, it, expect } from 'vitest';
import { PROCEDENCIA } from './floorSpec.js';
import {
  ORIGEN, observedItem, validarObservedProgram, esObservadoReal,
  confirmarObservado, resumenObservado, origenDeProcedencia,
} from './observedProgram.js';

describe('observed_program · contrato e invariantes (Plan Intelligence v1)', () => {
  it('normaliza al contrato canónico tolerando alias de floorSpec/programaDelPlano', () => {
    const it0 = observedItem({
      tipo: 'bench', semantic_role: 'ANCHOR_WORKSTATION', cantidad: 2, zona: 'OPERATIVA',
      functional_group_id: 'g1', x: 1000, y: 2000, rot: 90, w: 3000, d: 1200, h: 740,
      page: 2, evidencia: 'planta A-A', confianza: 0.9, procedencia: PROCEDENCIA.DETECTED_FROM_PLAN,
    });
    expect(it0.type).toBe('bench');
    expect(it0.quantity).toBe(2);
    expect(it0.zone).toBe('OPERATIVA');
    expect(it0.grouping).toBe('g1');
    expect(it0.position).toEqual({ x: 1000, y: 2000 });
    expect(it0.orientation).toBe(90);
    expect(it0.dimensions).toEqual({ w: 3000, d: 1200, h: 740 });
    expect(it0.page).toBe(2);
    expect(it0.origin).toBe(ORIGEN.OBSERVED);
    expect(it0.issues).toEqual([]);
  });

  it('origen deriva de procedencia: plano/usuario=observed, catálogo=inferred, IA/regla=suggested', () => {
    expect(origenDeProcedencia(PROCEDENCIA.DETECTED_FROM_PLAN)).toBe(ORIGEN.OBSERVED);
    expect(origenDeProcedencia(PROCEDENCIA.USER_CONFIRMED)).toBe(ORIGEN.OBSERVED);
    expect(origenDeProcedencia(PROCEDENCIA.CATALOG_MATCH)).toBe(ORIGEN.INFERRED);
    expect(origenDeProcedencia(PROCEDENCIA.AI_SUGGESTION)).toBe(ORIGEN.SUGGESTED);
    expect(origenDeProcedencia(PROCEDENCIA.RULE_SUGGESTION)).toBe(ORIGEN.SUGGESTED);
  });

  it('items inválidos: sin type, cantidad<=0, observed sin evidencia, sin confianza', () => {
    const r = validarObservedProgram([
      { cantidad: 1, confianza: 0.5, procedencia: PROCEDENCIA.AI_SUGGESTION },       // FALTA_TYPE
      { type: 'silla', cantidad: 0, confianza: 0.5, procedencia: PROCEDENCIA.AI_SUGGESTION }, // CANTIDAD_INVALIDA
      { type: 'mesa', cantidad: 1, procedencia: PROCEDENCIA.DETECTED_FROM_PLAN },     // OBSERVED_SIN_EVIDENCIA + FALTA_CONFIANZA
    ]);
    expect(r.ok).toBe(false);
    expect(r.issues.join(' ')).toMatch(/FALTA_TYPE/);
    expect(r.issues.join(' ')).toMatch(/CANTIDAD_INVALIDA/);
    expect(r.issues.join(' ')).toMatch(/OBSERVED_SIN_EVIDENCIA/);
  });

  it('INVARIANTE: un item SUGERIDO marcado con procedencia confirmada → issue', () => {
    // origin forzado suggested pero procedencia confirmada = contradicción.
    const r = validarObservedProgram([
      { type: 'silla', cantidad: 1, confianza: 0.5, origin: ORIGEN.SUGGESTED, procedencia: PROCEDENCIA.USER_CONFIRMED },
    ]);
    expect(r.issues.join(' ')).toMatch(/SUGERIDO_MARCADO_CONFIRMADO/);
  });

  it('NADA sugerido se confirma solo: confirmar es acto EXPLÍCITO → promueve a observed', () => {
    const sug = observedItem({ type: 'silla', cantidad: 4, confianza: 0.4, procedencia: PROCEDENCIA.AI_SUGGESTION });
    expect(esObservadoReal(sug)).toBe(false);
    const conf = confirmarObservado(sug, { por: 'rodrigo' });
    expect(conf.origin).toBe(ORIGEN.OBSERVED);
    expect(conf.procedencia).toBe(PROCEDENCIA.USER_CONFIRMED);
    expect(conf.confidence).toBe(1);
    expect(conf.confirmado_por).toBe('rodrigo');
    // el original NO mutó
    expect(sug.origin).toBe(ORIGEN.SUGGESTED);
  });

  it('CONTRATO (sintético, NO plano real): MUEBLES ≠ PUESTOS — 9 benches de 2 = 18 puestos, no 18 muebles', () => {
    // Datos SINTÉTICOS para probar la separación cantidad/capacidad (ChatGPT #4).
    // NO es un golden de un plano real; un golden real debe venir del lector.
    const programa = [
      { type: 'bench', role: 'ANCHOR_WORKSTATION', cantidad: 9, capacity_per_unit: 2, zona: 'OPERATIVA', evidencia: 'sintético', confianza: 0.9, procedencia: PROCEDENCIA.DETECTED_FROM_PLAN },
      { type: 'silla', role: 'WORK_SEAT', cantidad: 18, confianza: 0.4, procedencia: PROCEDENCIA.RULE_SUGGESTION },
    ];
    const res = resumenObservado(programa);
    expect(res.porOrigen[ORIGEN.OBSERVED]).toBe(9);        // 9 MUEBLES observados
    expect(res.capacidadObservada).toBe(18);               // 18 PUESTOS (9×2)
    expect(res.porOrigen[ORIGEN.SUGGESTED]).toBe(18);      // 18 sillas sugeridas
    expect(res.porTipo.bench).toBe(9);                     // por TIPO = muebles, no puestos
    expect(res.hayPendientesDeConfirmar).toBe(true);
  });

  it('DETERMINISTA: mismas entradas → mismo resumen', () => {
    const p = [{ type: 'bench', cantidad: 4, evidencia: 'x', confianza: 0.9, procedencia: PROCEDENCIA.DETECTED_FROM_PLAN }];
    expect(resumenObservado(p)).toEqual(resumenObservado(p));
  });

  // GROUND TRUTH REAL del PDF `01_COTIZAR_Oficina_Corporativa_132m2_ESCALA_1-50.pdf`
  // (QA-COT-01), verificado por ChatGPT contra el archivo. Esto es el observed_program
  // ESPERADO de ese plano — una FIXTURE de verdad, no inventada. NOTA honesta: aún NO
  // lo produce el lector real (leer-plano→FloorSpec→observed_program); cuando se cablee
  // el lector, su salida debe IGUALAR esta fixture (ahí será USER_FLOW_PASS). Hoy valida
  // el contrato y la separación muebles/puestos.
  const GOLDEN_A_132M2_8_PUESTOS = [
    { type: 'recepcion', role: 'ANCHOR_RECEPTION', cantidad: 1, dimensions: { w: 2000, d: 700 }, zona: 'RECEPCION', evidencia: 'R-01', confianza: 0.95, procedencia: PROCEDENCIA.DETECTED_FROM_PLAN, page: 1 },
    // B-01: 4 benches de 2 usuarios = 8 PUESTOS (no 8 benches, no 18).
    { type: 'bench', role: 'ANCHOR_WORKSTATION', cantidad: 4, capacity_per_unit: 2, dimensions: { w: 2400, d: 1400 }, zona: 'OPEN_SPACE', evidencia: 'B-01', confianza: 0.95, procedencia: PROCEDENCIA.DETECTED_FROM_PLAN, page: 1 },
    { type: 'silla_operativa', role: 'WORK_SEAT', cantidad: 8, zona: 'OPEN_SPACE', evidencia: 'S-01', confianza: 0.95, procedencia: PROCEDENCIA.DETECTED_FROM_PLAN, page: 1 },
    { type: 'mesa_juntas', role: 'ANCHOR_MEETING', cantidad: 1, capacity_per_unit: 8, dimensions: { w: 3200, d: 1200 }, zona: 'JUNTAS', evidencia: 'J-01', confianza: 0.9, procedencia: PROCEDENCIA.DETECTED_FROM_PLAN, page: 1 },
    { type: 'silla_juntas', role: 'MEETING_SEAT', cantidad: 8, zona: 'JUNTAS', evidencia: 'SJ-01', confianza: 0.9, procedencia: PROCEDENCIA.DETECTED_FROM_PLAN, page: 1 },
    { type: 'escritorio_direccion', role: 'ANCHOR_DESK', cantidad: 1, dimensions: { w: 2000, d: 900 }, zona: 'DIRECCION', evidencia: 'D-01', confianza: 0.9, procedencia: PROCEDENCIA.DETECTED_FROM_PLAN, page: 1 },
    { type: 'credenza', role: 'SUPPORT_STORAGE', cantidad: 1, dimensions: { w: 1200, d: 500 }, zona: 'DIRECCION', evidencia: 'CR-01', confianza: 0.9, procedencia: PROCEDENCIA.DETECTED_FROM_PLAN, page: 1 },
    { type: 'coffee_point', role: 'OTHER', cantidad: 1, dimensions: { w: 3300, d: 600 }, zona: 'AMENIDADES', evidencia: 'CF-01', confianza: 0.9, procedencia: PROCEDENCIA.DETECTED_FROM_PLAN, page: 1 },
  ];

  it('GOLDEN_A 132 m² (QA-COT-01, PDF real): Open Space = EXACTAMENTE 8 puestos (4 benches × 2)', () => {
    const AREA = { ancho: 15000, largo: 8800 };
    expect((AREA.ancho / 1000) * (AREA.largo / 1000)).toBeCloseTo(132, 5);

    const r = validarObservedProgram(GOLDEN_A_132M2_8_PUESTOS);
    expect(r.ok).toBe(true);

    const res = resumenObservado(GOLDEN_A_132M2_8_PUESTOS);
    // 8 tipos de mueble, todos OBSERVADOS del plano; nada sugerido/inferido.
    expect(res.porOrigen[ORIGEN.SUGGESTED]).toBe(0);
    expect(res.porOrigen[ORIGEN.INFERRED]).toBe(0);
    expect(res.hayPendientesDeConfirmar).toBe(false);

    // CLAVE (ChatGPT #3/#4): el Open Space es 8 PUESTOS, con 4 benches (muebles).
    const bench = r.items.find((i) => i.type === 'bench');
    expect(bench.quantity).toBe(4);              // 4 MUEBLES
    expect(bench.capacity_per_unit).toBe(2);
    expect(bench.capacity_total).toBe(8);        // 8 PUESTOS
    expect(res.porTipo.bench).toBe(4);           // por tipo = muebles, NO 8 ni 18

    // Cantidades exactas del cuadro real.
    const cant = (t) => (r.items.find((i) => i.type === t)?.quantity ?? 0);
    expect(cant('recepcion')).toBe(1);
    expect(cant('silla_operativa')).toBe(8);
    expect(cant('mesa_juntas')).toBe(1);
    expect(cant('silla_juntas')).toBe(8);
    expect(cant('escritorio_direccion')).toBe(1);
    expect(cant('credenza')).toBe(1);
    expect(cant('coffee_point')).toBe(1);
    // Mesa de juntas: 1 mueble, capacidad 8.
    const junta = r.items.find((i) => i.type === 'mesa_juntas');
    expect(junta.quantity).toBe(1);
    expect(junta.capacity_total).toBe(8);

    // NO existen "2 privados" inventados; dirección = 1 escritorio.
    expect(cant('escritorio_direccion')).not.toBe(2);
  });
});
