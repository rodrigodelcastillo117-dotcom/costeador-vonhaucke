import { describe, it, expect } from 'vitest';
import { amarrarPendientesERP } from './amarreERP.js';
import { MATCH } from './materialMatch.js';

const ERP = [
  { id: 'erp-led-5000', nombre: 'Kit iluminacion LED 5000K tira + fuente', unidad: 'kit', precio: 1890, clasificacion: 'erp' },
  { id: 'erp-led-3000', nombre: 'Kit iluminacion LED 3000K tira + fuente', unidad: 'kit', precio: 1790, clasificacion: 'erp' },
  { id: 'erp-contacto-doble', nombre: 'Contacto doble polarizado', unidad: 'pza', precio: 55, clasificacion: 'erp' },
  { id: 'erp-contacto-sin-precio', nombre: 'Contacto sencillo', unidad: 'pza', precio: null, clasificacion: 'erp' },
  { id: 'erp-ptr-1-cal14', nombre: 'PTR 1" cal. 14', unidad: 'm', precio: 48, clasificacion: 'erp' },
];
const buscar = async (q) => ERP.filter((r) => q.toLowerCase().split(/\s+/).some((w) => w.length > 2 && r.nombre.toLowerCase().includes(w)));

describe('amarre al catálogo de Compras (ERP) · provisional, nunca inventa precio', () => {
  it('pendiente con familia reconocible → se amarra al mejor del ERP (color/variante) y se agrega al catálogo local', async () => {
    const agregados = [];
    const comps = [{ nombre: 'Kit iluminación LED', material_solicitado: 'Kit iluminacion LED 5000 K (tiras + fuente + arnes)', material_match: MATCH.NOT_AVAILABLE, insumoId: '', cantidad: 1 }];
    const r = await amarrarPendientesERP(comps, { buscar, agregarInsumo: (i) => agregados.push(i.id), insumos: {} });
    expect(r.comps[0].insumoId).toBe('erp-led-5000'); expect(r.comps[0].material_match).toBe(MATCH.SAME_FAMILY_COMPATIBLE_PROPOSED);
    expect(r.comps[0]._match.erp).toBe(true); expect(agregados).toEqual(['erp-led-5000']); expect(r.amarrados[0].precio).toBe(1890);
  });
  it('prefiere filas CON precio; la sin precio no se escoge si hay otra', async () => {
    const r = await amarrarPendientesERP([{ nombre: 'Contacto eléctrico', material_solicitado: 'Contacto', material_match: 'NOT_AVAILABLE', insumoId: '' }], { buscar, agregarInsumo: () => {}, insumos: {} });
    expect(r.comps[0].insumoId).toBe('erp-contacto-doble');
  });
  it('sin familia reconocible (refrigerador del cliente) → no toca nada y lo lista', async () => {
    const r = await amarrarPendientesERP([{ nombre: 'Refrigerador doble puerta', material_solicitado: 'Refrigerador doble puerta de vidrio', material_match: 'NOT_AVAILABLE', insumoId: '' }], { buscar, agregarInsumo: () => {}, insumos: {} });
    expect(r.comps[0].insumoId).toBe(''); expect(r.sinCandidato).toEqual(['Refrigerador doble puerta']);
  });
  it('ya amarrado localmente → no se toca', async () => {
    const r = await amarrarPendientesERP([{ nombre: 'Bisagras', insumoId: 'bisagra', material_match: MATCH.SAME_FAMILY_COMPATIBLE_PROPOSED }], { buscar, agregarInsumo: () => { throw new Error('no debía'); }, insumos: {} });
    expect(r.amarrados).toHaveLength(0);
  });
  it('atributo crítico distinto (calibre) → candidato preseleccionado, NO costea', async () => {
    const r = await amarrarPendientesERP([{ nombre: 'Bastidor', material_solicitado: 'PTR 1" cal. 12', material_match: 'NOT_AVAILABLE', insumoId: '' }], { buscar, agregarInsumo: () => {}, insumos: {} });
    expect(r.comps[0].insumoId).toBe(''); expect(r.comps[0].material_match).toBe(MATCH.SAME_FAMILY_CRITICAL_CONFLICT); expect(r.comps[0].candidate_insumo_id).toBe('erp-ptr-1-cal14');
  });
  it('sin red (buscar falla) → todo queda como estaba', async () => {
    const r = await amarrarPendientesERP([{ nombre: 'Kit LED', material_solicitado: 'Kit LED', material_match: 'NOT_AVAILABLE', insumoId: '' }], { buscar: async () => { throw new Error('offline'); }, agregarInsumo: () => {}, insumos: {} });
    expect(r.comps[0].insumoId).toBe(''); expect(r.sinCandidato).toEqual(['Kit LED']);
  });
});
