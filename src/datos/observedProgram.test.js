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

  it('GOLDEN 18 PUESTOS: 18 benches observados + sillas sugeridas → resumen separa real de sugerido', () => {
    const programa = [
      // 18 puestos observados del plano (2 grupos bench)
      { type: 'bench', role: 'ANCHOR_WORKSTATION', cantidad: 10, zona: 'OPERATIVA', evidencia: 'planta', confianza: 0.95, procedencia: PROCEDENCIA.DETECTED_FROM_PLAN },
      { type: 'bench', role: 'ANCHOR_WORKSTATION', cantidad: 8, zona: 'OPERATIVA', evidencia: 'planta', confianza: 0.95, procedencia: PROCEDENCIA.DETECTED_FROM_PLAN },
      // sillas sugeridas por regla (1 por puesto) — NO confirmadas
      { type: 'silla', role: 'WORK_SEAT', cantidad: 18, confianza: 0.4, procedencia: PROCEDENCIA.RULE_SUGGESTION },
    ];
    const res = resumenObservado(programa);
    expect(res.porOrigen[ORIGEN.OBSERVED]).toBe(18);     // 18 puestos reales
    expect(res.porOrigen[ORIGEN.SUGGESTED]).toBe(18);    // 18 sillas sugeridas
    expect(res.cantidadObservada).toBe(18);
    expect(res.hayPendientesDeConfirmar).toBe(true);
    expect(res.porTipo.bench).toBe(18);
  });

  it('DETERMINISTA: mismas entradas → mismo resumen', () => {
    const p = [{ type: 'bench', cantidad: 4, evidencia: 'x', confianza: 0.9, procedencia: PROCEDENCIA.DETECTED_FROM_PLAN }];
    expect(resumenObservado(p)).toEqual(resumenObservado(p));
  });
});
