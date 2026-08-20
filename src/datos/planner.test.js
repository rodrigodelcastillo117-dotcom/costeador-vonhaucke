// ============================================================================
//  "CIRCULACIÓN ENTRE FILAS" EN EL FLUJO 1-CLIC (empacarTodoGarantizado).
//
//  El cartel de auditoría decía `ok: true` siempre, citando la regla
//  (`circulacion_min`, 900 mm por omisión) como si el empacador la usara para
//  separar TODAS las filas. En realidad `rowGap(tipo)` es una tabla fija que
//  NO lee la regla — para 'asiento' son 850 mm y para el resto ('mueble') 700,
//  los dos por debajo del default de 900. El cartel podía decir "✓ 0.90 m
//  entre muebles" cuando la separación real era 700-850 mm.
// ============================================================================
import { describe, it, expect } from 'vitest';
import { expandirPiezas } from './espacio.js';
import { acomodarLocal } from './planner.js';

// Muchos escritorios (fuerzan varias filas del mismo tipo) + sillas sueltas
// (tipo 'asiento', grupo aparte en `orden`): el cambio de grupo dispara un
// salto de fila con `rowGap('asiento') = 850 mm`, por debajo del default.
const ESCRITORIO = { id: 'e', nombre: 'Escritorio operativo 1.20', cantidad: 6, precioUnitario: 1, w: 1200, d: 750 };
const SILLON = { id: 'p', nombre: 'Sillón de espera', cantidad: 4, precioUnitario: 1, w: 700, d: 700 };

describe('circulación entre filas del flujo 1-clic', () => {
  it('avisa de verdad cuando el hueco real entre filas queda por debajo de la regla', () => {
    const piezas = expandirPiezas([ESCRITORIO, SILLON]);
    const r = acomodarLocal([{ nombre: 'Mi espacio', ancho: 6000, largo: 4000 }], piezas, { ajustar: true });
    const check = r.auditoria.find((a) => a.check === 'Circulación entre filas');
    expect(check).toBeTruthy();
    expect(check.ok).toBe(false);
    expect(check.detalle).toMatch(/0\.85 m/);
  });

  it('con un solo tipo de mueble (nunca cambia de fila por tipo) no hay falso negativo', () => {
    const piezas = expandirPiezas([{ ...ESCRITORIO, cantidad: 2 }]);
    const r = acomodarLocal([{ nombre: 'Mi espacio', ancho: 6000, largo: 4000 }], piezas, { ajustar: true });
    const check = r.auditoria.find((a) => a.check === 'Circulación entre filas');
    expect(check.ok).toBe(true);
  });
});
