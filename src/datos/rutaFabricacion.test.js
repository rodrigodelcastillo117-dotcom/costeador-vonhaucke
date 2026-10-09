import { describe, it, expect } from 'vitest';
import { operacion, rutaFabricacion, PROCESO, ESTADO_OP } from './rutaFabricacion.js';

describe('RUTA DE FABRICACIÓN / horas-hombre (ChatGPT §10)', () => {
  it('operación con tiempo + tarifa → OK, costo_mo correcto', () => {
    const o = operacion({ proceso: 'corte', setup_min: 0, tiempo_unitario_min: 30, cantidad: 1, tarifa_hora: 120, fuente: 'ruta', confianza: 0.9 });
    expect(o.estado).toBe(ESTADO_OP.OK);
    expect(o.tiempo_total_min).toBe(30);
    expect(o.costo_mo).toBeCloseTo(60, 4);     // 0.5 h × $120
  });

  it('SIN tiempo → PENDING, tiempo_total null (no se inventan minutos)', () => {
    const o = operacion({ proceso: 'soldadura', tarifa_hora: 150 });
    expect(o.estado).toBe(ESTADO_OP.PENDING);
    expect(o.issues).toContain('SIN_TIEMPO');
    expect(o.tiempo_total_min).toBeNull();
    expect(o.costo_mo).toBeNull();
  });

  it('SIN tarifa → PENDING, costo_mo null (no se inventa tarifa)', () => {
    const o = operacion({ proceso: 'pintura', tiempo_unitario_min: 20, cantidad: 2 });
    expect(o.estado).toBe(ESTADO_OP.PENDING);
    expect(o.issues).toContain('SIN_TARIFA');
    expect(o.tiempo_total_min).toBe(40);        // tiempo sí (hay datos)
    expect(o.costo_mo).toBeNull();              // costo no (sin tarifa)
  });

  it('proceso desconocido / tiempo o tarifa negativos → PENDING', () => {
    expect(operacion({ proceso: 'teletransporte', tiempo_unitario_min: 10, tarifa_hora: 100 }).issues).toContain('PROCESO_DESCONOCIDO');
    expect(operacion({ proceso: 'corte', tiempo_unitario_min: -5, tarifa_hora: 100 }).issues).toContain('TIEMPO_INVALIDO');
    expect(operacion({ proceso: 'corte', tiempo_unitario_min: 10, tarifa_hora: -1 }).issues).toContain('TARIFA_INVALIDA');
  });

  it('ruta con una operación PENDING → PRELIMINAR y totales null (no se cierra el costo)', () => {
    const r = rutaFabricacion([
      { proceso: 'corte', tiempo_unitario_min: 30, cantidad: 1, tarifa_hora: 120 },
      { proceso: 'ensamble', tiempo_unitario_min: 40, cantidad: 1 },   // sin tarifa → PENDING
    ]);
    expect(r.estado).toBe('PRELIMINAR');
    expect(r.pendientes).toBe(1);
    expect(r.tiempo_total_min).toBeNull();
    expect(r.costo_mo_total).toBeNull();
  });

  it('ruta completa → totales agregados', () => {
    const r = rutaFabricacion([
      { proceso: 'corte', setup_min: 10, tiempo_unitario_min: 30, cantidad: 1, tarifa_hora: 120 },      // 40 min, $80
      { proceso: 'ensamble', tiempo_unitario_min: 20, cantidad: 1, tarifa_hora: 150 },                   // 20 min, $50
    ]);
    expect(r.estado).toBe('OK');
    expect(r.tiempo_total_min).toBeCloseTo(60, 4);
    expect(r.costo_mo_total).toBeCloseTo(130, 4);
  });

  it('DETERMINISTA: misma ruta → mismo resultado', () => {
    const ops = [{ proceso: 'corte', tiempo_unitario_min: 30, cantidad: 1, tarifa_hora: 120 }];
    expect(rutaFabricacion(ops)).toEqual(rutaFabricacion(ops));
  });

  it('ruta vacía → PRELIMINAR', () => {
    expect(rutaFabricacion([]).estado).toBe('PRELIMINAR');
  });

  it('RED-TEAM C2: cantidad 0/negativa → CANTIDAD_INVALIDA + PENDING (no se coacciona a 1)', () => {
    for (const q of [0, -2]) {
      const o = operacion({ proceso: 'corte', setup_min: 5, tiempo_unitario_min: 10, tarifa_hora: 60, cantidad: q });
      expect(o.issues, `cantidad ${q}`).toContain('CANTIDAD_INVALIDA');
      expect(o.estado).toBe(ESTADO_OP.PENDING);
      expect(o.tiempo_total_min).toBeNull();     // no se fabrica tiempo
      expect(o.costo_mo).toBeNull();
    }
  });

  it('RED-TEAM M2: un tiempo/tarifa no-numérico (bool) NO se vuelve 0 → SIN_TIEMPO/SIN_TARIFA', () => {
    const o = operacion({ proceso: 'corte', tiempo_unitario_min: false, tarifa_hora: 60 });
    expect(o.issues).toContain('SIN_TIEMPO');     // false → null, no 0
    expect(o.costo_mo).toBeNull();
  });
});
