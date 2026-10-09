import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

// REALITY CUTOVER · la UI de Precios (Dirección) muestra la PROCEDENCIA de cada
// precio ("¿por qué $544?"), capa aditiva que NO cambia los números del motor.
describe('Precios · chip de procedencia cableado al CanonicalPriceResolver', () => {
  const s = fs.readFileSync('src/componentes/Precios.jsx', 'utf8');

  it('importa el adapter canónico VIVO del puente y el etiquetado por fuente', () => {
    expect(s).toContain("from '../datos/precioInsumoBridge.js'");
    expect(s).toContain('resolverPrecioInsumoVivo');
    expect(s).toContain('explicarPrecioInsumo');
    expect(s).toContain('etiquetaEstadoDeResolucion');
  });

  it('agrega la columna Procedencia y el chip por insumo', () => {
    expect(s).toContain('<th>Procedencia</th>');
    expect(s).toContain('<ChipProcedencia insumo={ins} />');
  });

  it('usa el adapter canónico (capturado-aware vive en el puente, no inline)', () => {
    expect(s).toContain('resolverPrecioInsumoVivo(insumo.id, insumo)');
    expect(s).toContain('precioCapturadoAMano(insumo)');
    // ya NO reimplementa la detección de captura inline
    expect(s).not.toContain('const capturado = insumo.precioBase > 0 && insumo.precio !== insumo.precioBase');
  });

  it('el "por qué" va en un tooltip accesible (title)', () => {
    expect(s).toContain('title={porque}');
  });
});
