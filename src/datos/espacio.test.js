import { describe, it, expect } from 'vitest';
import { huellaReal, expandirPiezas } from './espacio.js';

// ---------------------------------------------------------------------------
//  LA HUELLA DE LAS BANCAS SE CALCULABA DOS VECES (2026-08-16).
//  `nombreConBloque` (lineas.js) expande la banca al armar la partida y guarda
//  ahí la huella del bloque; `expandirPiezas` la volvía a expandir. Una banca
//  doble App LT de 10 usuarios a 1.50 pasaba de 7.50 m a 37.50 m, no cabía en
//  ninguna oficina y el open space se quedaba vacío mientras el acomodo decía
//  "se sale del área". No se ve leyendo el código: sólo aparece acomodando un
//  proyecto real, así que aquí queda clavado.
// ---------------------------------------------------------------------------
describe('huella de bancas y sofás', () => {
  it('expande una banca cuando la medida es de UN puesto', () => {
    // Cirque: 6 puestos, doble, 1.20 × 0.75 por puesto -> 3 columnas × 2 hileras.
    expect(huellaReal('Cirque · Banca doble 6 puestos', 1200, 750, 'escritorio'))
      .toEqual([3600, 1500]);
  });

  it('NO la vuelve a expandir si el nombre ya declara la huella', () => {
    expect(huellaReal('Cirque · Banca doble 6 puestos · ocupa 3.60 × 1.50 m', 3600, 1500, 'escritorio'))
      .toEqual([3600, 1500]);
  });

  it('NO expande una medida que ya es de bloque', () => {
    // App LT, 10 usuarios a 1.50: la partida ya trae los 7.50 m del bloque.
    expect(huellaReal('Banca doble APP LT 1.50 · 10 usuarios', 7500, 1200, 'escritorio'))
      .toEqual([7500, 1200]);
  });

  it('es idempotente: aplicarla dos veces da lo mismo que una', () => {
    const nombre = 'Banca doble APP LT 1.50 · 10 usuarios · ocupa 7.50 × 1.20 m';
    const una = huellaReal(nombre, 1500, 1200, 'escritorio');
    const dos = huellaReal(nombre, ...una, 'escritorio');
    expect(dos).toEqual(una);
  });

  it('un sofá de 3 plazas no se multiplica si ya viene armado', () => {
    expect(huellaReal('Pac · Sofá 3 plazas', 2100, 800, 'asiento')).toEqual([2100, 800]);
    // Pero un módulo suelto de 0.70 sí arma el sofá completo.
    expect(huellaReal('Pac · Sofá 3 plazas', 700, 800, 'asiento')).toEqual([2100, 800]);
  });
});

describe('expandirPiezas con la cotización real', () => {
  const PARTIDA = {
    id: 'p1',
    nombre: 'Banca doble APP LT 1.50 · 10 usuarios · ocupa 7.50 × 1.20 m',
    w: 7500, d: 1200, cantidad: 2, ruta: 'applt', productoId: 'banca_doble',
  };

  it('deja la banca en su medida real y no la multiplica por sus puestos', () => {
    const piezas = expandirPiezas([PARTIDA]);
    expect(piezas).toHaveLength(2);
    for (const p of piezas) {
      expect(p.w).toBe(7500);
      expect(p.d).toBe(1200);
    }
  });
});
