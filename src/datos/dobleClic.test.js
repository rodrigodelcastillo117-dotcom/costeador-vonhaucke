// Área J · R-06 (causa raíz): un doble clic en "Agregar" metía dos partidas idénticas (e2e/resiliencia.e2e.js · 5a/5b).
import { describe, it, expect } from 'vitest';
import { crearSeguroDobleClic, firmaAgregado } from './dobleClic.js';

const P = { id: 'p-1', nombre: 'Archivero director', cantidad: 1, precioUnitario: 69340, productoId: 'ECARS86P' };

describe('seguro de doble clic', () => {
  it('el mismo agregado dentro de la ventana es repetido; fuera de la ventana no', () => {
    let t = 1000; const rep = crearSeguroDobleClic({ ventanaMs: 800, ahora: () => t });
    const f = firmaAgregado([P]);
    expect(rep(f)).toBe(false);
    t += 15; expect(rep(f)).toBe(true);    // doble clic
    t += 1200; expect(rep(f)).toBe(false); // segundo clic deliberado
  });
  it('el id generado no cuenta; otro producto, cantidad o configuración sí entran', () => {
    let t = 0; const rep = crearSeguroDobleClic({ ahora: () => t });
    expect(rep(firmaAgregado([P]))).toBe(false);
    expect(rep(firmaAgregado([{ ...P, id: 'p-2' }]))).toBe(true);
    expect(rep(firmaAgregado([{ ...P, cantidad: 2 }]))).toBe(false);
    expect(rep(firmaAgregado([{ ...P, productoId: 'OTRO' }]))).toBe(false);
    expect(rep(firmaAgregado([{ ...P, productoId: 'OTRO', config: { usuarios: 4 } }]))).toBe(false);
  });
});
