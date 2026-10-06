import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// Gate UX: simplificar NUNCA significa borrar capacidades.
// Este test lee Inicio.jsx como superficie de navegación y falla si una ruta que
// existía antes del rediseño deja de estar disponible. Se permiten rutas nuevas.
const inicio = readFileSync(new URL('../componentes/Inicio.jsx', import.meta.url), 'utf8');

const DESTINOS_ESPERADOS = [
  'acomodo', 'archivo', 'banco', 'cocrear', 'comercial', 'costeador',
  'cotizacion', 'cotizarIA', 'especial', 'reglas', 'tablero', 'usuarios', 'voni',
];

const VISTAS_ESPERADAS = ['home', 'costear', 'cotizar', 'cotizarlinea'];

const LINEAS_ESPERADAS = [
  'applt', 'app', 'via', 'rio', 'feather', 'cirque', 'spine', 'ergo4', 'alba',
  'eclipse', 'drift', 'luna', 'anteo', 'mox', 'modulor', 'tetris', 'arlequin',
  'pac', 'worklounge', 'pebble', 'accents', 'teamspace2', 'privacy4',
];

describe('UX · ninguna función se pierde al simplificar', () => {
  it('conserva todos los destinos funcionales del Inicio anterior', () => {
    for (const ruta of DESTINOS_ESPERADOS) {
      expect(inicio, `falta destino ${ruta}`).toContain(`'${ruta}'`);
    }
  });

  it('conserva todos los subflujos del Inicio', () => {
    for (const vista of VISTAS_ESPERADAS) {
      expect(inicio, `falta vista ${vista}`).toContain(`'${vista}'`);
    }
  });

  it('conserva las 23 líneas de producto', () => {
    for (const ruta of LINEAS_ESPERADAS) {
      expect(inicio, `falta línea ${ruta}`).toMatch(new RegExp(`ruta:\\s*['"]${ruta}['"]`));
    }
  });

  it('la complejidad avanzada sigue siendo descubrible', () => {
    expect(inicio).toContain('Más herramientas');
    expect(inicio).toContain('Cocrear un producto');
    expect(inicio).toContain('Producto a la medida');
    expect(inicio).toContain('Todas las herramientas');
    expect(inicio).toContain('Lo que Voni sabe');
  });

  it('el camino principal usa lenguaje de resultado, no nombres de módulos', () => {
    expect(inicio).toContain('Nueva cotización');
    expect(inicio).toContain('Cotizar un producto conocido');
    expect(inicio).toContain('Costear un producto');
    expect(inicio).toContain('Abrir una cotización');
  });
});
