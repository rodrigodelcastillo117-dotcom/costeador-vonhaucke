// VH-063: el vendedor ve ANTES de verificar que su descuento exigirá aprobación.
import { describe, it, expect } from 'vitest';
import { leerPolitica, avisoDescuento } from './politicaComercial.js';

describe('leerPolitica', () => {
  it('normaliza la RPC (sólo descuento y versión; nunca inventa umbral)', () => {
    expect(leerPolitica({ vigente: true, version: 1, descuento_max_sin_aprobacion: 40 })).toEqual({ vigente: true, version: 1, descuentoMax: 40 });
    expect(leerPolitica({ vigente: false })).toEqual({ vigente: false, version: null, descuentoMax: null });
    expect(leerPolitica(null).vigente).toBe(false);
    expect(leerPolitica({ vigente: true, descuento_max_sin_aprobacion: 'x' }).vigente).toBe(false);
    expect(leerPolitica({ vigente: true, descuento_max_sin_aprobacion: 140 }).vigente).toBe(false);
  });
  it('no expone margen aunque venga', () => {
    const p = leerPolitica({ vigente: true, version: 1, descuento_max_sin_aprobacion: 40, margen_minimo_pct: 25 });
    expect(p).not.toHaveProperty('margenMin'); expect(JSON.stringify(p)).not.toMatch(/25/);
  });
});

describe('avisoDescuento', () => {
  const P = { vigente: true, version: 1, descuentoMax: 40 };
  it('por encima del umbral avisa con los números y la versión', () => {
    const a = avisoDescuento(45, P);
    expect(a.nivel).toBe('ambar');
    expect(a.texto).toMatch(/45%/); expect(a.texto).toMatch(/40%/); expect(a.texto).toMatch(/v1/); expect(a.texto).toMatch(/aprobación de Dirección/);
  });
  it('en o bajo el umbral, sin descuento, o sin política: nada', () => {
    expect(avisoDescuento(40, P)).toBeNull();
    expect(avisoDescuento(12.5, P)).toBeNull();
    expect(avisoDescuento(0, P)).toBeNull();
    expect(avisoDescuento(45, { vigente: false })).toBeNull();
    expect(avisoDescuento(45, null)).toBeNull();
    expect(avisoDescuento('abc', P)).toBeNull();
  });
});
