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
import { acomodarLocal, rolCuartoBase, tipoAreaConfiable } from './planner.js';
import { violacionesSemanticas } from './floorSpec.js';

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

// ============================================================================
//  VH-015 / LAYOUT-002 · CONSISTENCIA MOTOR ↔ VALIDADOR SEMÁNTICO.
//  El motor (`acomodarLocal`) coloca por "cabe"; el validador
//  (`violacionesSemanticas`) verifica "pertenece". La invariante dura: el motor
//  NUNCA debe producir un acomodo que su propio validador marque como violación.
//  Antes fallaba: la preferencia permitía fallbacks prohibidos (mesa de juntas a
//  un privado/operativa, recepción a operativa). Ahora un rol duro que no cabe en
//  una zona permitida SOBRA (se reporta sin colocar), no aterriza mal.
// ============================================================================
const MESA_JUNTAS = { id: 'mj', nombre: 'Mesa de juntas APP LT', cantidad: 1, precioUnitario: 1, w: 2800, d: 1200 };
const RECEPCION = { id: 'rc', nombre: 'Módulo recepción', cantidad: 1, precioUnitario: 1, w: 2200, d: 800 };
const ESCRITORIOS = { id: 'es', nombre: 'Escritorio operativo 1.20', cantidad: 4, precioUnitario: 1, w: 1200, d: 750 };

const byIdDe = (piezas) => Object.fromEntries(piezas.map((p) => [p.id, p]));

describe('VH-015 · el motor no produce acomodos que el validador marque', () => {
  it('mesa de juntas SIN sala de consejo: sobra, NO cae en Dirección (CEO) ni Operativa', () => {
    const areas = [
      { nombre: 'Dirección', ancho: 4500, largo: 4500 },        // CEO
      { nombre: 'Área Operativa', ancho: 10000, largo: 10000 },  // OPERATIVA
    ];
    const piezas = expandirPiezas([MESA_JUNTAS, ESCRITORIOS]);
    const r = acomodarLocal(areas, piezas);
    // El validador no debe encontrar ninguna violación en lo que el motor colocó.
    expect(violacionesSemanticas(r.colocacion, areas, byIdDe(piezas))).toHaveLength(0);
    // Y concretamente: la mesa de juntas no quedó colocada (no hay sala válida).
    expect(r.colocacion.some((c) => c.id === 'mj-1')).toBe(false);
  });

  it('recepción SIN cuarto de recepción: sobra, NO cae en Operativa', () => {
    const areas = [
      { nombre: 'Área Operativa', ancho: 10000, largo: 10000 }, // OPERATIVA
      { nombre: 'Dirección', ancho: 4500, largo: 4500 },        // CEO
    ];
    const piezas = expandirPiezas([RECEPCION, ESCRITORIOS]);
    const r = acomodarLocal(areas, piezas);
    expect(violacionesSemanticas(r.colocacion, areas, byIdDe(piezas))).toHaveLength(0);
    expect(r.colocacion.some((c) => c.id === 'rc-1')).toBe(false);
  });

  it('plano completo (todas las zonas): cero violaciones y cada rol en su zona', () => {
    const areas = [
      { nombre: 'Recepción', ancho: 5000, largo: 4000 },        // 0 RECEPCION
      { nombre: 'Sala de Juntas', ancho: 6000, largo: 5000 },    // 1 CONSEJO
      { nombre: 'Área Operativa', ancho: 12000, largo: 10000 },  // 2 OPERATIVA
      { nombre: 'Dirección', ancho: 4500, largo: 4500 },         // 3 CEO
    ];
    const piezas = expandirPiezas([MESA_JUNTAS, RECEPCION, ESCRITORIOS]);
    const r = acomodarLocal(areas, piezas);
    expect(violacionesSemanticas(r.colocacion, areas, byIdDe(piezas))).toHaveLength(0);
    // La mesa de juntas sí se coloca, y en la Sala de Juntas (área 1).
    const mesa = r.colocacion.find((c) => c.id === 'mj-1');
    expect(mesa).toBeTruthy();
    expect(mesa.area).toBe(1);
    // El módulo de recepción cae en la Recepción (área 0).
    const recep = r.colocacion.find((c) => c.id === 'rc-1');
    expect(recep).toBeTruthy();
    expect(recep.area).toBe(0);
  });
});


describe('layout funcional · silla operativa anclada a su puesto', () => {
  it('cada silla operativa colocada queda ligada a un escritorio real', () => {
    const areas = [{ nombre: 'Área Operativa', ancho: 7000, largo: 5000 }];
    const piezas = expandirPiezas([
      { id: 'desk', nombre: 'Escritorio operativo', cantidad: 1, precioUnitario: 1, w: 1600, d: 800 },
      { id: 'chair', nombre: 'Silla operativa', cantidad: 1, precioUnitario: 1, w: 600, d: 600 },
    ]);
    const r = acomodarLocal(areas, piezas);
    const silla = r.colocacion.find((x) => x.id === 'chair-1');
    expect(silla).toBeTruthy();
    expect(silla.anchor_id).toBe('desk-1');
    expect(silla.contra).toBe('escritorio:desk-1');
  });
});


describe('semántica de cuarto · procedencia manda', () => {
  it('tipo explícito confiable sí manda', () => {
    const a = { nombre:'Sala 1', tipo:'juntas', ancho:5000, largo:4000, procedencia:'DETECTED_FROM_PLAN', confianza:'alta' };
    expect(tipoAreaConfiable(a)).toBe(true);
    expect(rolCuartoBase(a, [a])).toBe('juntas');
  });

  it('tipo INFERRED de confianza baja no pisa el nombre/geom', () => {
    const a = { nombre:'Área Operativa', tipo:'juntas', ancho:9000, largo:7000, procedencia:'INFERRED', confianza:'baja' };
    expect(tipoAreaConfiable(a)).toBe(false);
    expect(rolCuartoBase(a, [a])).toBe('open');
  });
});
