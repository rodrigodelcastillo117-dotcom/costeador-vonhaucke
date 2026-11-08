// LOOP DE APRENDIZAJE: despiece confirmado → Producto Maestro → recostea EXACTO (round-trip).
import { describe, it, expect } from 'vitest';
import { bomDesdeDespiece, listoParaGuardar } from './productoMaestroDesdeDespiece.js';
import { costearBOM } from './productoMaestro.js';

const insumos = {
  lam: { nombre: 'Lamina cal.18', seccion: 'metal', unidad: 'hoja', precio: 800 },
  pin: { nombre: 'Pintura en polvo', seccion: 'acabados', unidad: 'kg', precio: 150 },
};
// Despiece del motor: lam 2.5 hojas (costo 2.5*800=2000), pin 3 kg (costo 450), + 1 sin mapear.
const detalle = [
  { insumoId: 'lam', precio: 800, costo: 2000, unidades: 2.5 },
  { insumoId: 'pin', precio: 150, costo: 450, comprado: 3 },
  { insumoId: '', precio: 0, costo: 0 },
];

describe('loop · despiece confirmado → Producto Maestro', () => {
  it('construye lineas con cantidad=costo/precio; descarta lo no mapeado (fail-closed)', () => {
    const bom = bomDesdeDespiece(detalle, insumos, { clave: 'nuevo-1', nombre: 'Mueble nuevo', factorMo: 0.1, factorGif: 0.25 });
    expect(bom.material_real).toBeCloseTo(2450, 2);
    expect(bom.lineas.length).toBe(2);
    expect(bom.descartadas.length).toBe(1);
    expect(bom.clave).toBe('NUEVO-1');
    expect(bom.tipo_bom).toBe('BOM_DETALLADO_VERIFICADO');
    expect(bom.lineas[0].cantidad).toBeCloseTo(2.5, 4); // 2000/800
  });

  it('al recostear reproduce EXACTO el costo del despiece y es certificable', () => {
    const bom = bomDesdeDespiece(detalle, insumos, { clave: 'nuevo-1', factorMo: 0.1, factorGif: 0.25 });
    const r = costearBOM(bom, insumos);
    expect(r.material).toBeCloseTo(2450, 2);
    expect(r.emitible).toBe(true);
    expect(r.orientativo).toBe(false);
    expect(r.certificable).toBe(true);
    expect(r.bloqueos.length).toBe(0);
  });

  it('si el precio del catalogo cambia, el costo flota con la cantidad fija', () => {
    const bom = bomDesdeDespiece(detalle, insumos, { clave: 'nuevo-1', factorMo: 0.1, factorGif: 0.25 });
    const nuevos = { ...insumos, lam: { ...insumos.lam, precio: 900 } };
    const r = costearBOM(bom, nuevos);
    expect(r.material).toBeCloseTo(2700, 2); // lam 2.5*900=2250 + pin 450
  });

  it('listoParaGuardar exige clave/lineas/factores y avisa de descartadas', () => {
    const malo = bomDesdeDespiece(detalle, insumos, { clave: '', factorMo: 0.1, factorGif: 0.25 });
    const v = listoParaGuardar(malo);
    expect(v.ok).toBe(false);
    expect(v.errores.some((e) => /clave/i.test(e))).toBe(true);
    expect(v.aviso).toMatch(/no se guardar/i);

    const bueno = bomDesdeDespiece(detalle, insumos, { clave: 'ok-1', factorMo: 0.1, factorGif: 0.25 });
    expect(listoParaGuardar(bueno).ok).toBe(true);
  });
});
