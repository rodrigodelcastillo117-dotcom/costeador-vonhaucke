import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

// REALITY CUTOVER · la UI de Precios (Dirección) muestra la PROCEDENCIA de cada
// precio ("¿por qué $544?"), capa aditiva que NO cambia los números del motor.
describe('Precios · chip de procedencia cableado al CanonicalPriceResolver', () => {
  const s = fs.readFileSync('src/componentes/Precios.jsx', 'utf8');

  it('importa el puente real y el resolver de procedencia', () => {
    expect(s).toContain("from '../datos/precioInsumoBridge.js'");
    expect(s).toContain('resolverPrecioInsumo');
    expect(s).toContain('explicarPrecioInsumo');
    expect(s).toContain('etiquetaEstadoPrecio');
  });

  it('agrega la columna Procedencia y el chip por insumo', () => {
    expect(s).toContain('<th>Procedencia</th>');
    expect(s).toContain('<ChipProcedencia insumo={ins} />');
  });

  it('un precio CAPTURADO a mano NO reclama "compra real" (provisional sin evidencia)', () => {
    expect(s).toContain('const capturado = insumo.precioBase > 0 && insumo.precio !== insumo.precioBase');
    expect(s).toContain('Capturado a mano');
    expect(s).toContain('fuente: null');       // al capturar, no hereda la fuente del catálogo
  });

  it('el "por qué" va en un tooltip accesible (title)', () => {
    expect(s).toContain('title={porque}');
  });
});
