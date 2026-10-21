import { describe, it, expect, vi } from 'vitest';

// E2E 2026-10-20: un escritorio de 1.60 m tenía de "referencia comercial real" faldones y conductos
// ($720–$870) porque se buscaba '%Escritorio%' y se tomaban los más baratos.
const PRODUCTOS = [
  { id: 1, nombre: 'FALDON RECTO PARA ESCRITORIO DE 1050 X 390 mm MODELO ALBA', activo: true },
  { id: 2, nombre: 'ESCRITORIO RECTANGULAR DE 1500 X 751 X 600 MM MODELO FLEX OPG', activo: true },
  { id: 3, nombre: 'ESCRITORIO RECTANGULAR DE 1800 X 751 X 600 MM MODELO FLEX OPG', activo: true },
  { id: 4, nombre: 'ESCRITORIO RECTANGULAR DE 1200 X 751 X 600 MM MODELO FLEX OPG', activo: true },
];
const PRECIOS = [
  { producto_id: 1, precio_lista: 720 }, { producto_id: 2, precio_lista: 4150 },
  { producto_id: 3, precio_lista: 5200 }, { producto_id: 4, precio_lista: 3900 },
];
let filtroNombre = null;
vi.mock('../nube.js', () => {
  const q = (tabla) => {
    const st = { tabla };
    const api = {
      select: () => api, neq: () => api, not: () => api, limit: () => api,
      ilike: (_c, patron) => { filtroNombre = patron; st.patron = patron; return api; },
      in: (_c, ids) => { st.ids = ids; return api; },
      then: (res) => {
        if (tabla === 'productos') {
          const re = new RegExp('^' + st.patron.replace(/%/g, '.*') + '$', 'i');
          return Promise.resolve({ data: PRODUCTOS.filter((p) => re.test(p.nombre)), error: null }).then(res);
        }
        if (tabla === 'lista_precio_items') return Promise.resolve({ data: PRECIOS.filter((x) => (st.ids || []).includes(x.producto_id)), error: null }).then(res);
        return Promise.resolve({ data: [], error: null }).then(res);
      },
    };
    return api;
  };
  return { nube: { from: q } };
});

describe('Cocrear · referencia comercial de un escritorio', () => {
  it('sólo escritorios (no faldones) y el más parecido en largo primero', async () => {
    const { referenciasComercialesCocrear } = await import('./cocrearReferencias.js');
    const r = await referenciasComercialesCocrear({ familia: 'ESCRITORIO', dimensiones: { ancho_mm: 1600 } });
    expect(filtroNombre).toBe('Escritorio%');
    expect(r.items.map((x) => x.producto_id)).not.toContain(1);
    expect(r.items[0].producto_id).toBe(2);              // 1500 es el más cercano a 1600
    expect(r.rango_precio.min).toBeGreaterThan(1000);
  });
});
