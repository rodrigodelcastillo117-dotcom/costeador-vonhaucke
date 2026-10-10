import { describe, it, expect } from 'vitest';
import {
  proponerProgramaDelPlano, proponerPrograma, aplicarPrograma,
  resolverYConfirmar, partidasParaAcomodo, partidasPropuestas,
  propuestaBloqueada, previewAplicacionPrograma, resolverAplicacionAtomica,
} from './programaRealDelPlano.js';
import { validarCoherenciaPrograma } from './coherenciaPrograma.js';

const areasM = [
  { nombre: 'OFICINA CEO', tipo: 'privado', ancho: 4, largo: 3.2 },
  { nombre: 'SALA DE CONSEJO', tipo: 'juntas', ancho: 7, largo: 3.2, puestos: 4 },
  { nombre: 'ÁREA OPERATIVA', tipo: 'open', ancho: 8, largo: 3.2, puestos: 10 },
  { nombre: 'RECEPCIÓN', tipo: 'recepcion', ancho: 4, largo: 2.4 },
];

describe('programaRealDelPlano · PROPONER no confirma (P0.1 · #2/#3)', () => {
  it('proponer SÓLO resuelve: preview real, NADA entra a cotización todavía', () => {
    const r = proponerProgramaDelPlano(areasM, { linea: 'App LT' });
    expect(r.preview.length).toBeGreaterThan(0);
    expect(r.preview.every((p) => p.source === 'PROPUESTO_PROGRAMA')).toBe(true);  // NO confirmado
    expect(r.preview.every((p) => p.bancoId && !String(p.bancoId).startsWith('sug-'))).toBe(true);
    expect(r.preview.some((p) => p.w === 7500)).toBe(false);
    expect(r.propuesta.cotizable).toBe(true);
  });

  it('APLICAR confirma: partidas reales que PASAN coherencia, sin sug-*', () => {
    const { propuesta } = proponerProgramaDelPlano(areasM, { linea: 'App LT' });
    const ap = aplicarPrograma(propuesta, { existentes: [] });
    expect(ap.partidas.every((p) => p.source === 'CONFIRMADO_PROGRAMA')).toBe(true);
    const v = validarCoherenciaPrograma(ap.partidas);
    expect(v.ok).toBe(true);
    expect(v.bloqueos).toHaveLength(0);
  });

  it('idempotente: re-aplicar sobre lo confirmado no duplica', () => {
    const { propuesta } = proponerProgramaDelPlano(areasM, { linea: 'App LT' });
    const a1 = aplicarPrograma(propuesta, { existentes: [] });
    const a2 = aplicarPrograma(propuesta, { existentes: a1.confirmacion.items });
    expect(a2.confirmacion.confirmadas).toHaveLength(0);
    expect(a2.partidas.length).toBe(a1.partidas.length);
  });

  it('#19: la identidad de zona del FloorSpec (nombre del área) llega a la resolución', () => {
    const r = proponerProgramaDelPlano(areasM, { linea: 'App LT' });
    const bench = r.propuesta.resoluciones.find((x) => x.relation_role === 'ANCHOR_WORKSTATION');
    expect(bench.zone_id).toBe('ÁREA OPERATIVA');
    const rec = r.propuesta.resoluciones.find((x) => x.relation_role === 'ANCHOR_RECEPTION');
    expect(rec.zone_id).toBe('RECEPCIÓN');
    expect(bench.requirement_id).toContain('ÁREA OPERATIVA');
  });

  it('#4: el BRIEF estructurado llega al resolver por el punto de entrada vivo', () => {
    const r = proponerProgramaDelPlano(areasM, {
      linea: 'App LT',
      brief: { privados: [{ requested_models: { anchor: 'Eclipse Drift 2.10' } }] },
    });
    // el privado del plano + brief Drift → NEEDS_CONFIRMATION (nunca sustituido)
    expect(r.propuesta.pendientes.some((p) => p.rol === 'privado' && p.product_status === 'NEEDS_CONFIRMATION')).toBe(true);
    expect(r.propuesta.partidas.some((p) => String(p.bancoId).startsWith('dir-'))).toBe(false);
  });
});

describe('resolverYConfirmar · GOLDEN APP LT 10 directo (P0.1 · #5)', () => {
  const r = resolverYConfirmar({ operativos: 10, brief: { operativosStorage: true } }, { linea: 'App LT' });

  it('1 bench real 6000×1200 + 10 sillas + 10 gavetas (pedidas), coherente', () => {
    const bench = r.partidas.filter((p) => p.relation_role === 'ANCHOR_WORKSTATION');
    expect(bench).toHaveLength(1);
    expect(bench[0].bancoId).toBe('op-10u-6000x1200-cristal');
    expect(bench[0].w).toBe(6000);
    const sillas = r.partidas.filter((p) => p.relation_role === 'WORK_SEAT').reduce((s, p) => s + p.cantidad, 0);
    const gavetas = r.partidas.filter((p) => p.relation_role === 'UNDERDESK_STORAGE').reduce((s, p) => s + p.cantidad, 0);
    expect(sillas).toBe(10);
    expect(gavetas).toBe(10);
    expect(validarCoherenciaPrograma(r.partidas).ok).toBe(true);
    expect(r.ok).toBe(true);
  });

  it('seats ligados a la instancia del ancla (no al bancoId)', () => {
    const bench = r.partidas.find((p) => p.relation_role === 'ANCHOR_WORKSTATION');
    const seat = r.partidas.find((p) => p.relation_role === 'WORK_SEAT');
    expect(seat.anchor_instance_id).toBe(bench.instance_id);
  });

  it('nombre semántico reconocible pero mismo producto real', () => {
    const bench = r.partidas.find((p) => p.relation_role === 'ANCHOR_WORKSTATION');
    expect(bench.nombre).toMatch(/bench operativo/i);
    expect(bench.piezaId).toBe('op-10u-6000x1200-cristal');
  });

  it('partidasParaAcomodo/partidasPropuestas vacías sin datos', () => {
    expect(partidasParaAcomodo(null)).toEqual([]);
    expect(partidasParaAcomodo({ items: [] })).toEqual([]);
    expect(partidasPropuestas(null)).toEqual([]);
  });

  it('sin brief: gavetas NO entran a comercial (recomendación)', () => {
    const r2 = proponerPrograma({ operativos: 10 }, { linea: 'App LT' });
    const gavetas = r2.preview.filter((p) => p.relation_role === 'UNDERDESK_STORAGE');
    expect(gavetas).toHaveLength(0);
  });
});

// ============================================================================
//  OPERACIÓN RESCATE · caso Torre Sur (plano ARQ-01, 2026-10-10). El privado se pidió
//  como "Escritorio ejecutivo Eclipse 2.10 m" (línea real, precio de catálogo) pero el
//  resolver sólo conoce el BANCO → ESCRITORIO_SOLICITADO_NO_CANONICO → bloqueaba Propuesta
//  y el apply del bench SIN camino para resolverlo. Puente: si la cotización YA trae ese
//  producto de línea con la MISMA identidad (ruta+producto+medida), cuenta como cubierto.
// ============================================================================
describe('RESCATE · pendiente NO_CANONICO cubierto por partida de LÍNEA (misma identidad)', () => {
  const AREAS_TS = [
    { nombre: 'OFICINA CEO', tipo: 'privado', ancho: 4, largo: 3.2 },
    { nombre: 'ÁREA OPERATIVA', tipo: 'open', ancho: 8, largo: 3.2, puestos: 8 },
  ];
  const BRIEF_TS = {
    linea: 'App LT',
    privados: [{
      requested_route: 'eclipse', requested_product: 'escritorio', requested_line: 'eclipse',
      requested_models: { anchor: 'Escritorio ejecutivo Eclipse 2.10 m, mano derecha, chapa' },
      requested_dimensions: { w: null, d: 2100 },        // dimsDeSeleccion guarda largoMM bajo `d`
    }],
    juntas: [],
  };
  const ECLIPSE_2100 = { id: 'p-ecl', piezaId: 'linea-escritorio', ruta: 'eclipse', productoId: 'escritorio', nombre: 'Eclipse Escritorio Directivo 2.10 m · mano Derecha', cantidad: 1, precioUnitario: 81470, config: { largoMM: 2100, mano: 'D', finish: 'chapa' } };

  it('SIN la partida: pendiente NO_CANONICO con identidad de línea, y el apply está BLOQUEADO (fail-closed)', () => {
    const r = proponerProgramaDelPlano(AREAS_TS, { linea: 'App LT', brief: BRIEF_TS });
    const pend = r.propuesta.pendientes.filter((p) => p.rol === 'privado');
    expect(pend).toHaveLength(1);
    expect(pend[0].faltante.reason).toBe('ESCRITORIO_SOLICITADO_NO_CANONICO');
    expect(pend[0].faltante.requested.route).toBe('eclipse');
    expect(pend[0].faltante.requested.product).toBe('escritorio');
    expect(r.cubiertosPorLinea).toEqual([]);
    expect(propuestaBloqueada(r.propuesta)).toBe(true);
    expect(resolverAplicacionAtomica(r.propuesta, { existentes: [] }).committed).toBe(false);
    // el bench resuelto se ve como PREVIEW aunque el apply esté bloqueado
    expect(previewAplicacionPrograma(r.propuesta, { existentes: [] }).nuevas.some((p) => /^op-/.test(String(p.bancoId)))).toBe(true);
  });

  it('CON la partida Eclipse 2.10 de línea: el pendiente queda CUBIERTO y el apply del bench se desbloquea', () => {
    const r = proponerProgramaDelPlano(AREAS_TS, { linea: 'App LT', brief: BRIEF_TS, existentes: [ECLIPSE_2100] });
    expect(r.cubiertosPorLinea.map((c) => c.rol)).toEqual(['privado']);
    expect(r.cubiertosPorLinea[0].cubierto_por_linea.id).toBe('p-ecl');
    expect(r.propuesta.pendientes.some((p) => p.rol === 'privado')).toBe(false);
    expect(r.propuesta.incompletos.some((i) => i.code === 'ANCLA_NEEDS_CONFIRMATION')).toBe(false);
    expect(propuestaBloqueada(r.propuesta)).toBe(false);
    const ap = resolverAplicacionAtomica(r.propuesta, { existentes: [ECLIPSE_2100] });
    expect(ap.committed).toBe(true);
    expect(ap.nuevas.some((p) => /^op-/.test(String(p.bancoId)))).toBe(true);
    // la partida Eclipse existente NO se toca ni se duplica
    expect(ap.partidas.filter((p) => p.id === 'p-ecl')).toHaveLength(1);
    expect(ap.partidas.some((p) => /^dir-/.test(String(p.bancoId || p.piezaId || '')))).toBe(false);
  });

  it('identidad EXACTA: otro largo, otro producto o una sugerencia NO cubren', () => {
    const otroLargo = proponerProgramaDelPlano(AREAS_TS, { linea: 'App LT', brief: BRIEF_TS, existentes: [{ ...ECLIPSE_2100, config: { largoMM: 2400 } }] });
    expect(otroLargo.cubiertosPorLinea).toEqual([]);
    const otroProd = proponerProgramaDelPlano(AREAS_TS, { linea: 'App LT', brief: BRIEF_TS, existentes: [{ ...ECLIPSE_2100, productoId: 'cantilever' }] });
    expect(otroProd.cubiertosPorLinea).toEqual([]);
    const sugerida = proponerProgramaDelPlano(AREAS_TS, { linea: 'App LT', brief: BRIEF_TS, existentes: [{ ...ECLIPSE_2100, id: 'sug-1', sugeridoPlano: true }] });
    expect(sugerida.cubiertosPorLinea).toEqual([]);
    expect(propuestaBloqueada(otroLargo.propuesta)).toBe(true);
  });
});
