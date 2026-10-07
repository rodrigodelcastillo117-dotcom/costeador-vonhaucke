import { describe, it, expect } from 'vitest';
import { resolverPrograma, resolverPrivado, resolverJuntas } from './resolverPrograma.js';

const esReal = (p) => p && p.bancoId && !String(p.bancoId).startsWith('sug-')
  && p.product_status === 'RESOLVED' && Number(p.precio_lista_snapshot) > 0 && p.source === 'RESUELTO';
const sumBy = (arr, rol) => arr.filter((d) => d.relation_role === rol).reduce((s, d) => s + (d.cantidad || 0), 0);

describe('golden privado (P0.1 · #9): escritorio directivo REAL + asiento, sin inventar', () => {
  it('privado → ancla ANCHOR_DESK real (dir-*) con identidad', () => {
    const a = resolverPrivado();
    expect(esReal(a)).toBe(true);
    expect(a.relation_role).toBe('ANCHOR_DESK');
    expect(String(a.bancoId)).toMatch(/^dir-/);
    expect(a.identity_status).toBe('RESOLVED');
    expect(a.identidad.producto_id).toBeTruthy();
  });

  it('un privado resuelve a 1 ancla + 1 asiento ejecutivo REAL (ALPHA), sin extras inventados', () => {
    const r = resolverPrograma({ privados: 1 }, { linea: 'App LT' });
    const anclas = r.resoluciones.filter((x) => x.relation_role === 'ANCHOR_DESK');
    expect(anclas).toHaveLength(1);
    const dep = r.dependientes;
    expect(dep).toHaveLength(1);
    expect(dep[0].relation_role).toBe('EXECUTIVE_SEAT');
    expect(dep[0].anchor_role).toBe('ANCHOR_DESK');
    expect(dep[0].bancoId).toBe('silla-alpha');
    expect(esReal(dep[0])).toBe(true);
    expect(dep.some((d) => /credenza|visit|concerto/i.test(d.nombre || ''))).toBe(false);
    expect(r.productosReales).toBe(true);
  });
});

describe('golden juntas (P0.1 · #10): 4 personas → mesa REAL + 4 sillas', () => {
  it('capacidad 4 → mesa que cubre ≥4 + exactamente 4 MEETING_SEAT reales', () => {
    const r = resolverPrograma({ salas: [4] }, { linea: 'App LT' });
    const mesa = r.resoluciones.find((x) => x.relation_role === 'ANCHOR_MEETING');
    expect(esReal(mesa)).toBe(true);
    expect(mesa.usuarios).toBeGreaterThanOrEqual(4);
    expect(sumBy(r.dependientes, 'MEETING_SEAT')).toBe(4);
    expect(r.dependientes.filter((d) => d.relation_role === 'MEETING_SEAT').every(esReal)).toBe(true);
  });

  it('resolverJuntas nunca inventa: siempre un producto real del catálogo', () => {
    const m = resolverJuntas(10);
    expect(esReal(m)).toBe(true);
    expect(m.usuarios).toBeGreaterThanOrEqual(10);
  });
});

describe('golden recepción (P0.1 · #11): mostrador REAL, SIN sillas de espera no pedidas', () => {
  it('recepción → 1 ancla recepción real y CERO dependientes por defecto', () => {
    const r = resolverPrograma({ recepcion: true }, { linea: 'App LT' });
    const rec = r.resoluciones.find((x) => x.relation_role === 'ANCHOR_RECEPTION');
    expect(esReal(rec)).toBe(true);
    expect(String(rec.bancoId)).toMatch(/^rec-/);
    expect(r.dependientes).toHaveLength(0);
  });
});
