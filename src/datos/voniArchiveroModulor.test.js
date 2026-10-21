import { describe, it, expect } from 'vitest';
import { catalogoIA, costearItem } from './lineas.js';

// E2E 2026-10-20: "10 archiveros modulor (5 izquierdos y 5 derechos)" salía como MOA1CA a $2,890
// (precio del modelo) en un solo renglón, en vez de MOAHCL4I/D a $8,132 (precio real).
describe('Voni · archivero registro lateral Modulor', () => {
  const modulor = catalogoIA().modulor.productos;
  it('el catálogo le dice a Voni cuál es el registro lateral de 1.20 con 2 cajones', () => {
    const h = modulor.find((p) => p.id === 'archivero_h');
    expect(h.nota).toMatch(/MOAHCL4I/);
    expect(h.params.modelo).toEqual(expect.arrayContaining(['cajones120izq', 'cajones120der']));
    expect(modulor.find((p) => p.id === 'archivero_lateral').nota).toMatch(/NO es el archivero de 1\.20/);
  });
  it('izquierdo y derecho cuestan el precio real de octubre ($8,132)', () => {
    for (const modelo of ['cajones120izq', 'cajones120der']) {
      const c = costearItem({}, { ruta: 'modulor', producto: 'archivero_h', cantidad: 5, seleccion: [{ clave: 'modelo', valor: modelo }, { clave: 'finish', valor: 'ABS' }] });
      expect(c).toBeTruthy();
      expect(c.precioUnitario).toBeCloseTo(8132, 2);
    }
  });
  it('Flex: Voni sabe que "cajón" incluye la charola y que hay rodante', () => {
    const esc = catalogoIA().flex.productos.find((p) => p.id === 'escritorio');
    expect(esc.nota).toMatch(/charola/);
    expect(esc.nota).toMatch(/FXESCCM24M19ABS/);
  });
});
