import { describe, it, expect } from 'vitest';
import { medirError, medirPorCapa, clasificarConfianza, veredicto } from './validacionCosteo.js';

describe('validacionCosteo · medirError', () => {
  it('mide sobrecosteo, subcosteo y exacto con signo', () => {
    expect(medirError(110, 100)).toMatchObject({ error_pct: 10, signo: 'SOBRECOSTEA' });
    expect(medirError(90, 100)).toMatchObject({ error_pct: -10, signo: 'SUBCOSTEA' });
    expect(medirError(100, 100).signo).toBe('EXACTO');
  });
  it('sin costo real -> NO medible (no finge validacion)', () => {
    expect(medirError(15250, null).medible).toBe(false);
    expect(medirError(15250, 0).medible).toBe(false);
  });
  it('mide por capa', () => {
    const r = medirPorCapa({ material: 4483, total: 15250 }, { material: 4483, total: 13000 });
    expect(r.material.signo).toBe('EXACTO');
    expect(r.total.signo).toBe('SOBRECOSTEA');
  });
});

describe('validacionCosteo · clasificarConfianza (proveniencia, no optimismo)', () => {
  it('certificable SOLO si fab anclada + precios vigentes + SIN estimados + terceros MEDIDOS', () => {
    const r = clasificarConfianza({ fabAncladaVerificada: true, fabErrorPct: 0.1,
      todosPreciosVigentes: true, hayConsumoEstimado: false, tercerosMedidos: true });
    expect(r.nivel).toBe('certificable');
  });
  it('fab anclada pero terceros SIN medir -> estimado (el caso real de las vitrinas del concurso)', () => {
    const r = clasificarConfianza({ fabAncladaVerificada: true, fabErrorPct: 0.0,
      todosPreciosVigentes: true, hayConsumoEstimado: false, tercerosMedidos: false });
    expect(r.nivel).toBe('estimado');
    expect(r.motivos.join(' ')).toMatch(/terceros.*NO fue medida/);
  });
  it('consumo estimado (lamina por area) -> estimado (Cubo/Caja)', () => {
    const r = clasificarConfianza({ fabAncladaVerificada: true, todosPreciosVigentes: true,
      hayConsumoEstimado: true, tercerosMedidos: false });
    expect(r.nivel).toBe('estimado');
  });
  it('fab NO anclada o motor fallo-cerrado -> bloqueado', () => {
    expect(clasificarConfianza({ fabAncladaVerificada: false }).nivel).toBe('bloqueado');
    expect(clasificarConfianza({ bloqueado: true }).nivel).toBe('bloqueado');
  });
  it('veredicto UI', () => {
    expect(veredicto('certificable')).toMatch(/CERTIFICABLE/);
    expect(veredicto('estimado')).toMatch(/ESTIMADO/);
  });
});

describe('validacionCosteo · aplicado al concurso R5 (estado HONESTO hoy)', () => {
  // Hoy NINGUN mueble del concurso es certificable: la capa de terceros no se midio
  // contra un costo real (no existe en el sistema). La maquina lo dice sola.
  const concurso = {
    Horizontal: { fabAncladaVerificada: true, fabErrorPct: 0, todosPreciosVigentes: true, hayConsumoEstimado: false, tercerosMedidos: false },
    Torre:      { fabAncladaVerificada: true, fabErrorPct: 0, todosPreciosVigentes: true, hayConsumoEstimado: false, tercerosMedidos: false },
    Isla:       { fabAncladaVerificada: true, fabErrorPct: 0, todosPreciosVigentes: true, hayConsumoEstimado: false, tercerosMedidos: false },
    Almacen:    { fabAncladaVerificada: true, fabErrorPct: 0, todosPreciosVigentes: false, hayConsumoEstimado: true, tercerosMedidos: false },
    Cubo:       { fabAncladaVerificada: true, todosPreciosVigentes: false, hayConsumoEstimado: true, tercerosMedidos: false },
    Caja:       { fabAncladaVerificada: true, todosPreciosVigentes: false, hayConsumoEstimado: true, tercerosMedidos: false },
  };
  it('ninguno es certificable hoy (terceros sin medir) -> todos ESTIMADO, ninguno 🟢', () => {
    for (const [, c] of Object.entries(concurso)) {
      expect(clasificarConfianza(c).nivel).not.toBe('certificable');
    }
  });
  it('el instante que se mide la capa de terceros contra un real, sube a certificable', () => {
    const horizontalMedido = { fabAncladaVerificada: true, fabErrorPct: 0, todosPreciosVigentes: true, hayConsumoEstimado: false, tercerosMedidos: true };
    expect(clasificarConfianza(horizontalMedido).nivel).toBe('certificable');
  });
});
