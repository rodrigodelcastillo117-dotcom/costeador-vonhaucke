import { describe, it, expect } from 'vitest';
import { amarrarPendientesERP } from './amarreERP.js';
import { MATCH } from './materialMatch.js';

// Bug "muy alto": 14 remaches mapeados al genérico 'tornilleria' (juego $45) → 14×45=$630.
// El amarre ahora re-mapea ese genérico al remache específico del ERP ($0.26), aunque el juego ya traiga precio.
describe('amarre · genéricos "juego" con precio → artículo específico del ERP', () => {
  const buscar = async (q) => {
    const s = String(q).toLowerCase();
    if (/remache|pop/.test(s)) return [{ id: 'erp-remache-pop', nombre: 'REMACHE POP ALUMINIO AM-46', precio: 0.26, unidad: 'pza' }];
    return [];
  };

  it('re-mapea un remache atascado en "tornilleria" al remache del ERP', async () => {
    const comps = [{ nombre: 'Remaches', material_solicitado: 'remache pop aluminio', insumoId: 'tornilleria', cantidad: 14 }];
    const insumos = { tornilleria: { id: 'tornilleria', nombre: 'Tornilleria', precio: 45 } };
    const agregar = (f) => { insumos[f.id] = f; };
    const { comps: out, amarrados } = await amarrarPendientesERP(comps, { buscar, agregarInsumo: agregar, insumos });
    expect(out[0].insumoId).toBe('erp-remache-pop');
    expect(out[0].material_match).toBe(MATCH.SAME_FAMILY_COMPATIBLE_PROPOSED);
    expect(amarrados).toHaveLength(1);
    expect(amarrados[0].precio).toBe(0.26);
  });

  it('NO toca un insumo real no-genérico que ya cuesta', async () => {
    const comps = [{ nombre: 'Cubierta', material_solicitado: 'mdf 19', insumoId: 'mdf-19', material_match: MATCH.EXACT }];
    const insumos = { 'mdf-19': { id: 'mdf-19', nombre: 'MDF 19', precio: 300 } };
    const { comps: out, amarrados } = await amarrarPendientesERP(comps, { buscar, agregarInsumo: () => {}, insumos });
    expect(out[0].insumoId).toBe('mdf-19');     // no es bucket genérico → intacto
    expect(amarrados).toHaveLength(0);
  });

  it('si el ERP no da nada específico, deja el genérico tal cual (no empeora)', async () => {
    const comps = [{ nombre: 'Tornillería surtida', material_solicitado: 'tornilleria surtida', insumoId: 'tornilleria', cantidad: 1 }];
    const insumos = { tornilleria: { id: 'tornilleria', nombre: 'Tornilleria', precio: 45 } };
    const { comps: out } = await amarrarPendientesERP(comps, { buscar, agregarInsumo: () => {}, insumos });
    expect(out[0].insumoId).toBe('tornilleria');
  });
});
