import { describe, it, expect } from 'vitest';
import { fusionarAcomodo } from './acomodoEstado.js';

describe('VH-109 · fusionarAcomodo es idempotente por contenido', () => {
  const plan = { colocacion: [{ id: 'p-1-1', area: 2, x: 0, y: 600 }], layoutSpec: { status: 'PARTIAL' } };
  const previo = { areas: [{ nombre: 'A', ancho: 4000, largo: 3000 }], plan, planReal: true };

  it('mismo contenido con objetos nuevos ⇒ sinCambios y conserva el objeto previo', () => {
    const r = fusionarAcomodo(previo, { areas: [{ nombre: 'A', ancho: 4000, largo: 3000 }], plan: JSON.parse(JSON.stringify(plan)), planReal: true });
    expect(r.sinCambios).toBe(true);
    expect(r.acomodo).toBe(previo);
  });

  it('un cambio real (plan nuevo) ⇒ acomodo fusionado y conserva lo que no vino en el parche', () => {
    const r = fusionarAcomodo(previo, { plan: { ...plan, colocacion: [] } });
    expect(r.sinCambios).toBe(false);
    expect(r.acomodo.plan.colocacion).toEqual([]);
    expect(r.acomodo.planReal).toBe(true);
    expect(r.acomodo.areas).toEqual(previo.areas);
  });

  it('sin acomodo previo ⇒ el parche es el acomodo', () => {
    const r = fusionarAcomodo(null, { plan });
    expect(r.sinCambios).toBe(false);
    expect(r.acomodo).toEqual({ plan });
  });

  it('parche vacío sobre previo ⇒ sinCambios', () => {
    expect(fusionarAcomodo(previo, {}).sinCambios).toBe(true);
    expect(fusionarAcomodo(previo, null).sinCambios).toBe(true);
  });
});
