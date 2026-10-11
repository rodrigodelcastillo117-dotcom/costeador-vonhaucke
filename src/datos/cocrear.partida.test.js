// VH-058: la partida que nace de Cocrear lleva identidad y procedencia por el contrato.
import { describe, it, expect } from 'vitest';
import { partidaDesdeCocrear, cocrear } from './cocrear.js';
import { crearPartida, validarPartida } from './partida.js';

const spec = cocrear('Recepción curva 2.40 m nogal oscuro con iluminación integrada para dos personas').spec;

describe('partidaDesdeCocrear → crearPartida', () => {
  it('conserva Producto Maestro, expediente, origen cocrear y render URL', () => {
    const costeo = partidaDesdeCocrear({ nombre: 'Recepción Aurora', spec, prodId: 77, versionId: 901, expedienteId: 12, renderUrl: 'https://x.supabase.co/storage/v1/object/public/renders/cocrear/12/r.png' });
    expect(costeo).toMatchObject({ source_type: 'expediente', source_ref: '12', expedienteId: 12, origen: 'cocrear', precioReal: false });
    const p = crearPartida({ ...costeo, cantidad: 1, precioUnitario: 48000, costoUnitario: 24000, margen: 50 }, { veCostos: true, origen: costeo.origen });
    expect(p).toMatchObject({ producto_id: 77, producto_version_id: 901, source_type: 'expediente', source_ref: '12', expedienteId: 12, origen: 'cocrear', render: costeo.render, nombre: 'Recepción Aurora' });
    expect(validarPartida(p)).toEqual([]);
    // Vendedor: misma identidad y procedencia, sin economía.
    const v = crearPartida({ ...costeo, cantidad: 1, precioUnitario: 48000 }, { veCostos: false, origen: costeo.origen });
    expect(v).toMatchObject({ producto_id: 77, producto_version_id: 901, expedienteId: 12, sellerSafe: true });
    expect(v).not.toHaveProperty('costoUnitario');
  });
  it('un render base64 no viaja; sin expediente no hay source_ref', () => {
    const c = partidaDesdeCocrear({ spec, prodId: 1, versionId: 2, expedienteId: null, renderUrl: 'data:image/png;base64,AA' });
    expect(c.render).toBeNull();
    expect(c.source_ref).toBeNull();
    expect(c.nombre).toMatch(/Recepción/);
  });
});
