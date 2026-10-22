import { describe, it, expect } from 'vitest';
import { estadoHumano, esBloqueante, COLOR } from './estadoHumano.js';

describe('estadoHumano — calibración del brief', () => {
  it('DEPENDENT_DETACHED es la frase humana exacta, amarillo y deja continuar', () => {
    const r = estadoHumano('DEPENDENT_DETACHED');
    expect(r.frase).toBe('Esta silla quedó demasiado lejos de su mesa.');
    expect(r.color).toBe(COLOR.AMARILLO);
    expect(r.continuar).toBe(true);
  });
  it('ECONOMICS_INCOMPLETE es amarillo (no error) y deja continuar como borrador', () => {
    const r = estadoHumano('ECONOMICS_INCOMPLETE');
    expect(r.color).toBe(COLOR.AMARILLO);
    expect(r.continuar).toBe(true);
    expect(r.frase.toLowerCase()).toContain('falta confirmar un costo');
  });
});

describe('estadoHumano — semáforo', () => {
  it('ALLOWED = verde, se puede', () => {
    expect(estadoHumano('ALLOWED')).toMatchObject({ color: COLOR.VERDE, continuar: true });
  });
  it('LAYOUT_VALID = verde', () => {
    expect(estadoHumano('LAYOUT_VALID').color).toBe(COLOR.VERDE);
  });
  it.each(['BLOCKED', 'FAIL', 'FALLA', 'OVERLAP', 'BLOCKS_DOOR', 'REQUIERE_DESARROLLO', 'descuento_invalido', 'cantidad_invalida', 'precio_invalido', 'no_corresponde_a_lo_costeado'])(
    'rojo bloquea: %s', (c) => {
      const r = estadoHumano(c);
      expect(r.color).toBe(COLOR.ROJO);
      expect(r.continuar).toBe(false);
      expect(esBloqueante(c)).toBe(true);
    });
  it.each(['LAYOUT_INCOMPLETE', 'REVIEW_REQUIRED', 'PARTIAL', 'SUGERIDO', 'INFERIDO', 'SAME_FAMILY_COMPATIBLE_PROPOSED', 'STALE', 'sin_guardar', 'partidas_no_corresponden'])(
    'amarillo deja continuar: %s', (c) => {
      const r = estadoHumano(c);
      expect(r.color).toBe(COLOR.AMARILLO);
      expect(r.continuar).toBe(true);
      expect(esBloqueante(c)).toBe(false);
    });
});

describe('estadoHumano — robustez', () => {
  it('es insensible a mayúsculas/minúsculas y espacios', () => {
    expect(estadoHumano('  allowed ').color).toBe(COLOR.VERDE);
    expect(estadoHumano('economics_incomplete').color).toBe(COLOR.AMARILLO);
  });
  it('familias por prefijo: recosteo_* = rojo, linea_N_costo_desconocido = amarillo', () => {
    expect(estadoHumano('recosteo_pendiente_producto').color).toBe(COLOR.ROJO);
    expect(estadoHumano('recosteo_pendiente_material').color).toBe(COLOR.ROJO);
    expect(estadoHumano('linea_3_costo_desconocido').color).toBe(COLOR.AMARILLO);
  });
  it('desambigua por ámbito los códigos que colisionan', () => {
    expect(estadoHumano('PENDIENTE', { ambito: 'aprobacion' }).frase.toLowerCase()).toContain('aprobación pendiente');
    expect(estadoHumano('alta', { ambito: 'lectura' }).color).toBe(COLOR.VERDE);
    expect(estadoHumano('nula', { ambito: 'lectura' }).color).toBe(COLOR.ROJO);
    expect(estadoHumano('media', { ambito: 'confianza' }).color).toBe(COLOR.AMARILLO);
  });
  it('código desconocido: amarillo "puedes continuar" (el gate real es del servidor), marcado desconocido', () => {
    const r = estadoHumano('ALGO_QUE_NO_EXISTE_123');
    expect(r.color).toBe(COLOR.AMARILLO);
    expect(r.continuar).toBe(true);
    expect(r.desconocido).toBe(true);
  });
  it('vacío/null devuelve el desconocido seguro', () => {
    expect(estadoHumano('').desconocido).toBe(true);
    expect(estadoHumano(null).desconocido).toBe(true);
  });
});

describe('estadoHumano — invariante de color/continuar', () => {
  it('nada rojo deja continuar; nada verde/amarillo bloquea', () => {
    const rojos = ['BLOCKED', 'FAIL', 'OVERLAP', 'HITS_OBSTACLE', 'OUT_OF_BOUNDS', 'GHOST_PLACEMENT', 'precio_especial_no_autoritativo', 'sin_permiso', 'REQUIERE_DESARROLLO'];
    for (const c of rojos) expect(estadoHumano(c).continuar).toBe(false);
    const siguen = ['ALLOWED', 'LAYOUT_VALID', 'EXACT', 'CONFIRMADO', 'DOOR_SWING_UNKNOWN', 'NO_SPACE', 'ANCHOR_WRONG_ZONE'];
    for (const c of siguen) expect(estadoHumano(c).continuar).toBe(true);
  });
});
