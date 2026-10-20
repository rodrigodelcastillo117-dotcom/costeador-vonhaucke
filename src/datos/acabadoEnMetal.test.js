// Cierre ChatGPT (cocrear-1, 2026-10-20): "Pintura en polvo negro mate (base)" con lo pedido "acabado negro mate en metal".
// La pintura que Diseño confirmó se descartaba como cruce de familia (pintura → metal) y el servidor la cambiaba por
// "Frente de metal" (mampara por m²): costo equivocado y bloqueo de ingeniería.
import { describe, it, expect } from 'vitest';
import { reconciliarMaterialServidor, aplicarPoliticaMaterial } from './materialMatch.js';

const cat = {
  'pintura-polvo-negro': { id: 'pintura-polvo-negro', nombre: 'Pintura en polvo negro mate 8 (Vitracoat)', seccion: 'acabados', clasificacion: 'nuevo', unidad: 'kg', precio: 120.68 },
  'frente-metal': { id: 'frente-metal', nombre: 'Frente de metal', seccion: 'mamparas', clasificacion: 'vigente', unidad: 'm2', precio: 153.6 },
  'lamina-cal18': { id: 'lamina-cal18', nombre: 'Lamina de acero cal. 18', seccion: 'metal', clasificacion: 'vigente', unidad: 'hoja', precio: 900 },
};
const resolver = (id) => cat[id];
const pintura = { nombre: 'Pintura en polvo negro mate (base)', insumoId: 'pintura-polvo-negro', material_solicitado: 'acabado negro mate en metal', material_confirmado: true, cantidad: 1 };

describe('acabado descrito "en metal" en un renglón de pintura', () => {
  it('la pintura confirmada por Diseño se respeta (no se cambia por Frente de metal)', () => {
    const r = reconciliarMaterialServidor(pintura, resolver, Object.values(cat), { puedeConfirmar: true });
    expect(r.insumoId).toBe('pintura-polvo-negro');
    expect(r.material_match).toBe('USER_CONFIRMED');
    expect(r.material_solicitado).toBe('acabado negro mate en metal');   // lo pedido no se reescribe
  });
  it('sin confirmación tampoco se autollena con un material base', () => {
    const r = aplicarPoliticaMaterial({ ...pintura, insumoId: '', material_confirmado: false }, resolver, Object.values(cat));
    expect(r.insumoId).not.toBe('frente-metal');
    expect(r.insumoId).not.toBe('lamina-cal18');
  });
  it('una pieza de metal (no acabado) sigue pidiendo metal', () => {
    const r = aplicarPoliticaMaterial({ nombre: 'Faldón metálico', insumoId: 'pintura-polvo-negro', material_solicitado: 'lámina negra mate', material_confirmado: true, cantidad: 1 }, resolver, Object.values(cat));
    expect(r.material_match).not.toBe('USER_CONFIRMED');   // cruce de familia sin override: no se promueve
  });
});
