import { describe, it, expect } from 'vitest';
import { briefDePropuesta, briefTieneSenal, requirementsDeBrief } from './programaBrief.js';
import { resolverPrograma } from './resolverPrograma.js';

// Fixture con el SCHEMA REAL de cotizar-texto v10 (sin campos mágicos):
//   items[]: { ruta, producto, cantidad, seleccion:[{clave,valor}], etiqueta, confianza, nota, material_override }
//   banco[]: { id, cantidad, etiqueta, nota, sugerido }
const PROPUESTA_V10 = {
  items: [
    { ruta: 'drift', producto: 'escritorio-directivo', cantidad: 1, seleccion: [{ clave: 'ancho', valor: '2100' }], etiqueta: 'Eclipse Drift 2.10 directivo', confianza: 'alta', nota: '', material_override: '' },
    { ruta: 'applt', producto: 'mesa-juntas', cantidad: 1, seleccion: [{ clave: 'ancho', valor: '1200' }, { clave: 'largo', valor: '1200' }], etiqueta: 'Mesa de juntas', confianza: 'alta', nota: '', material_override: '' },
  ],
  banco: [
    { id: 'silla-alpha', cantidad: 1, etiqueta: 'Silla directiva ALPHA' },
    { id: 'silla-concerto', cantidad: 2, etiqueta: 'Silla de visita CONCERTO' },
    { id: 'silla-win', cantidad: 10, etiqueta: 'Silla operativa WIN' },
    { id: 'gaveta-mox', cantidad: 10, etiqueta: 'Gaveta MOX' },
  ],
  textoOriginal: 'privado con Eclipse Drift 2.10, mesa de juntas 1200x1200, 10 WIN, ALPHA, 2 CONCERTO, 10 gavetas',
};

describe('programaBrief · contra el contrato REAL de cotizar-texto v10 (P0.1 · #1-#7)', () => {
  const brief = briefDePropuesta(PROPUESTA_V10);
  const req = requirementsDeBrief(brief);

  it('versiona la interpretación (#6): version, source, interpretation_id, source_text_hash', () => {
    expect(brief.version).toBe(1);
    expect(brief.source).toBe('cotizar-texto');
    expect(brief.interpretation_id).toMatch(/^int-/);
    expect(brief.source_text_hash).toBeTruthy();
    expect(brief.interpreted_at).toBeTruthy();
  });

  it('privado: ruta/producto/seleccion → requested_models.anchor + dims (del seleccion), SIN campos mágicos', () => {
    const p = req.privados[0];
    expect(p.requested_route).toBe('drift');
    expect(p.requested_product).toBe('escritorio-directivo');
    expect(p.requested_models.anchor).toMatch(/drift/i);
    expect(p.requested_dimensions).toEqual({ w: 2100, d: null });
  });

  it('juntas: dimensiones salen del seleccion (1200×1200)', () => {
    expect(req.juntas[0].requested_dimensions).toEqual({ w: 1200, d: 1200 });
  });

  it('#3 BANCO es parte del brief: modelos por id resueltos con metadata canónica', () => {
    expect(req.operativoSeatModel).toBe('silla-win');          // WORK_SEAT
    expect(req.operativosStorage).toBe(true);                   // gaveta → storage pedido
    expect(req.privados[0].requested_models.seat).toBe('silla-alpha');   // EXECUTIVE_SEAT
    expect(req.privados[0].requested_visitors).toEqual({ model: 'silla-concerto', cantidad: 2 });
  });

  it('#5 UNKNOWN ≠ false: sin evidencia de storage, operativosStorage queda null', () => {
    const r2 = requirementsDeBrief(briefDePropuesta({ items: [], banco: [{ id: 'silla-win', cantidad: 4 }] }));
    expect(r2.operativosStorage).toBeNull();
    expect(briefTieneSenal(r2)).toBe(true);
  });

  it('#1/#7 CONTRATO E2E: brief v10 → resolver → Drift NEEDS_CONFIRMATION, NUNCA App LT', () => {
    const r = resolverPrograma({ privados: 1, salas: [4], brief: req }, { linea: 'App LT' });
    expect(r.pendientes.some((p) => p.rol === 'privado' && p.product_status === 'NEEDS_CONFIRMATION')).toBe(true);
    expect(r.partidas.some((p) => String(p.bancoId).startsWith('dir-'))).toBe(false);
    // juntas 1200×1200 sí resuelve a mesa real
    expect(r.partidas.some((p) => p.relation_role === 'ANCHOR_MEETING' && p.w === 1200)).toBe(true);
  });
});
