// Área J · R-05 (causa raíz): el despiece del Costeo manual vivía sólo en memoria; una recarga lo borraba sin
// aviso (e2e/resiliencia.e2e.js · 4d). El borrador se conserva en esta computadora y se recupera.
import { describe, it, expect } from 'vitest';
import { CLAVE_BORRADOR_COSTEO, costeoConContenido, guardarBorradorCosteo, leerBorradorCosteo, borrarBorradorCosteo } from './borradorCosteo.js';

const memoria = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m }; };
const COSTEO = { nombre: 'Mesa de juntas Torre Norte', piezas: 1, componentes: [{ nombre: 'Cubierta especial 1.20', insumoId: 'mdf16', largoMM: 1200, anchoMM: 600, piezas: 1, cantidad: 1 }], margen: null };

describe('borrador del costeo manual', () => {
  it('guarda y recupera el despiece tal cual (ida y vuelta)', () => {
    const s = memoria();
    expect(guardarBorradorCosteo(s, COSTEO, new Date('2026-10-13T18:00:00Z'))).toBe(true);
    const b = leerBorradorCosteo(s);
    expect(b).toMatchObject({ version: 1, guardado: '2026-10-13T18:00:00.000Z' });
    expect(b.costeo).toEqual(COSTEO);
  });
  it('un costeo en blanco no se guarda y retira el borrador anterior', () => {
    const s = memoria();
    guardarBorradorCosteo(s, COSTEO);
    guardarBorradorCosteo(s, { nombre: '', componentes: [], piezas: 1 });
    expect(s.getItem(CLAVE_BORRADOR_COSTEO)).toBeNull();
    expect(leerBorradorCosteo(s)).toBeNull();
    expect(costeoConContenido({ componentes: [{ nombre: '  ' }] })).toBe(false);
    expect(costeoConContenido({ descripcionCliente: 'banca' })).toBe(true);
  });
  it('dañado o sin storage: no lanza y no inventa nada', () => {
    const s = memoria(); s.setItem(CLAVE_BORRADOR_COSTEO, '{roto');
    expect(leerBorradorCosteo(s)).toBeNull();
    expect(leerBorradorCosteo(null)).toBeNull();
    expect(guardarBorradorCosteo(null, COSTEO)).toBe(false);
    const lleno = { ...memoria(), setItem: () => { throw new Error('QuotaExceededError'); } };
    expect(guardarBorradorCosteo(lleno, COSTEO)).toBe(false);
  });
  it('no guarda imágenes base64 gigantes; borrar retira la clave', () => {
    const s = memoria();
    guardarBorradorCosteo(s, { ...COSTEO, imagen: `data:image/png;base64,${'A'.repeat(200000)}` });
    expect(leerBorradorCosteo(s).costeo.imagen).toBeNull();
    borrarBorradorCosteo(s);
    expect(s.getItem(CLAVE_BORRADOR_COSTEO)).toBeNull();
  });
});
