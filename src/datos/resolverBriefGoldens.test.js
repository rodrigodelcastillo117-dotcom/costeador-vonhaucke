import { describe, it, expect } from 'vitest';
import { resolverPrograma, resolverJuntas, resolverPrivado } from './resolverPrograma.js';

describe('brief privado (P0.1 · #7): modelo pedido o NEEDS_CONFIRMATION, nunca sustitución', () => {
  it('Eclipse Drift 2.10 (no canónico) → NEEDS_CONFIRMATION, NO un dir-* en su lugar', () => {
    const r = resolverPrivado({ requested_models: { anchor: 'Eclipse Drift 2.10' } });
    expect(r.product_status).toBe('NEEDS_CONFIRMATION');
    expect(r.bancoId).toBeNull();                       // NO sustituye con App LT
    expect(r.faltante.reason).toBe('ESCRITORIO_SOLICITADO_NO_CANONICO');
    expect(r.faltante.requested.model).toMatch(/drift/i);
  });

  it('sin pedido específico → directivo canónico REAL (dir-*)', () => {
    const r = resolverPrivado();
    expect(r.product_status).toBe('RESOLVED');
    expect(String(r.bancoId)).toMatch(/^dir-/);
  });

  it('orquestador: privado con Drift → va a pendientes, NO a partidas; ok=false', () => {
    const r = resolverPrograma({ privados: 1, brief: { privados: [{ requested_models: { anchor: 'Eclipse Drift 2.10' } }] } });
    expect(r.ok).toBe(false);
    expect(r.partidas.some((p) => String(p.bancoId).startsWith('dir-'))).toBe(false);
    expect(r.pendientes.some((p) => p.rol === 'privado' && p.product_status === 'NEEDS_CONFIRMATION')).toBe(true);
    expect(r.incompletos.some((i) => i.code === 'ANCLA_NEEDS_CONFIRMATION')).toBe(true);
  });
});

describe('brief juntas (P0.1 · #8): respeta medida pedida', () => {
  it('mesa 1200×1200 pedida y capacidad 4 → esa mesa real', () => {
    const r = resolverJuntas(4, { requested_dimensions: { w: 1200, d: 1200 } });
    expect(r.product_status).toBe('RESOLVED');
    expect(r.w).toBe(1200); expect(r.d).toBe(1200);
    expect(r.usuarios).toBeGreaterThanOrEqual(4);
  });

  it('mesa 1200×1200 pedida pero capacidad 10 → NEEDS_CONFIRMATION (la medida no cubre)', () => {
    const r = resolverJuntas(10, { requested_dimensions: { w: 1200, d: 1200 } });
    expect(r.product_status).toBe('NEEDS_CONFIRMATION');
    expect(r.faltante.reason).toBe('DIM_NO_CUBRE_CAPACIDAD');
  });

  it('medida inexistente (9999×9999) → NEEDS_CONFIRMATION, no otra mesa', () => {
    const r = resolverJuntas(4, { requested_dimensions: { w: 9999, d: 9999 } });
    expect(r.product_status).toBe('NEEDS_CONFIRMATION');
    expect(r.bancoId).toBeNull();
    expect(r.faltante.reason).toBe('MESA_SOLICITADA_NO_CANONICA');
  });
});

describe('juntas capacidad (P0.1 · #9): resolved_capacity ≥ requested', () => {
  it('MUTACIÓN: 20 personas NO puede quedar RESOLVED con una mesa de 14', () => {
    const r = resolverJuntas(20);
    expect(r.product_status).toBe('NEEDS_CONFIRMATION');
    expect(r.faltante.reason).toBe('CAPACITY_NOT_COVERED');
    expect(r.faltante.capacidad).toBe(20);
    expect(r.faltante.max).toBeLessThan(20);
    expect(r.bancoId).toBeNull();                       // no finge cobertura
  });

  it('capacidad cubrible (8) sí resuelve a mesa real ≥8', () => {
    const r = resolverJuntas(8);
    expect(r.product_status).toBe('RESOLVED');
    expect(r.usuarios).toBeGreaterThanOrEqual(8);
  });
});

describe('modelos de silla (P0.1 · #10): el rol decide DÓNDE, no QUÉ modelo', () => {
  it('juntas con modelo de silla pedido (SONATA) respeta el modelo', () => {
    const r = resolverPrograma({ salas: [4], brief: { juntas: [{ requested_models: { seat: 'sonata' } }] } });
    const silla = r.dependientes.find((d) => d.relation_role === 'MEETING_SEAT');
    expect(silla.bancoId).toBe('silla-sonata');         // no el default concerto
  });

  it('modelo de silla inexistente → NEEDS_CONFIRMATION (no se cambia por otro)', () => {
    const r = resolverPrograma({ salas: [4], brief: { juntas: [{ requested_models: { seat: 'silla-inexistente-xyz' } }] } });
    expect(r.ok).toBe(false);
    expect(r.pendientes.some((p) => p.relation_role === 'MEETING_SEAT' && p.product_status === 'NEEDS_CONFIRMATION')).toBe(true);
    expect(r.partidas.some((p) => p.relation_role === 'MEETING_SEAT')).toBe(false);
  });

  it('privado con visitas pedidas (2 CONCERTO) las agrega como requested, modelo respetado', () => {
    const r = resolverPrograma({ privados: 1, brief: { privados: [{ requested_visitors: { cantidad: 2, model: 'concerto' } }] } });
    const vis = r.dependientes.find((d) => d.relation_role === 'VISITOR_SEAT');
    expect(vis.cantidad).toBe(2);
    expect(vis.bancoId).toBe('silla-concerto');
    expect(vis.inclusion).toBe('requested');
  });
});

describe('FloorSpec identity (P0.1 · #16): zone_id/evidence viajan hasta la resolución', () => {
  it('operativo con zone_id/evidence del brief → ancla y dependientes los conservan', () => {
    const r = resolverPrograma({
      operativos: 10,
      brief: { operativoZoneId: 'zone:open-1', operativoEvidence: { page: 3, conf: 0.92 } },
    }, { linea: 'App LT' });
    const ancla = r.resoluciones.find((x) => x.relation_role === 'ANCHOR_WORKSTATION');
    expect(ancla.zone_id).toBe('zone:open-1');
    expect(ancla.evidence).toEqual({ page: 3, conf: 0.92 });
    expect(ancla.requirement_id).toContain('zone:open-1');
    const seat = r.dependientes.find((d) => d.relation_role === 'WORK_SEAT');
    expect(seat.zone_id).toBe('zone:open-1');            // heredado del ancla
    expect(seat.requirement_id).toBe(ancla.requirement_id);
  });

  it('el requerimiento también reporta zone_id/evidence (contrato para P0.3)', () => {
    const r = resolverPrograma({ privados: 1, brief: { privados: [{ zone_id: 'zone:ceo', evidence: { page: 1 } }] } });
    const req = r.requerimientos.find((q) => q.rol === 'privado');
    expect(req.zone_id).toBe('zone:ceo');
    expect(req.evidence).toEqual({ page: 1 });
  });
});
