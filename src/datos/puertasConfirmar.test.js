import { describe, it, expect } from 'vitest';
import { paredDePuerta, puertaConfirmada, puertaDobleConfirmada, confirmarPuertaEnArea, puertasSinConfirmar } from './puertasConfirmar.js';

const RECEPCION = { nombre: 'RECEPCIÓN', ancho: 6, largo: 7 };
const D08 = { x: 3.4, y: 7, ancho: 1.8, tieneBarrido: false, sentido: 'desconocido', confianza: 'media' };

describe('VH-136 · confirmar bisagra y sentido', () => {
  it('detecta la pared por la cota más cercana', () => {
    expect(paredDePuerta(D08, RECEPCION)).toBe('yL');
    expect(paredDePuerta({ x: 3, y: 0 }, RECEPCION)).toBe('y0');
    expect(paredDePuerta({ x: 0, y: 3 }, RECEPCION)).toBe('x0');
    expect(paredDePuerta({ x: 6, y: 3 }, RECEPCION)).toBe('xW');
  });

  it('hoja sencilla en la pared de abajo: bisagra izquierda (vista desde adentro) y abre hacia adentro', () => {
    // Desde adentro mirando hacia abajo (+y), "izquierda" es +x: la bisagra queda a la derecha en pantalla.
    const p = puertaConfirmada({ x: 3, y: 7, ancho: 0.9 }, RECEPCION, { bisagra: 'izquierda', abre: 'adentro' });
    expect(p.tieneBarrido).toBe(true);
    expect([p.bisagraX, p.bisagraY]).toEqual([3.45, 7]);
    expect(p.anguloCerradaDeg).toBe(180);        // la hoja cerrada apunta hacia -x desde la bisagra
    expect(p.sentido).toBe('horario');           // 180° → 270° (hacia -y = adentro) es horario
    expect(p.barridoDeg).toBe(90);
    expect(p.confianza).toBe('usuario_confirmado');
  });

  it('misma hoja abriendo hacia afuera cambia el sentido, no la bisagra', () => {
    const p = puertaConfirmada({ x: 3, y: 7, ancho: 0.9 }, RECEPCION, { bisagra: 'izquierda', abre: 'afuera' });
    expect([p.bisagraX, p.bisagraY]).toEqual([3.45, 7]);
    expect(p.sentido).toBe('antihorario');       // 180° → 90° (hacia +y = afuera)
  });

  it('reproduce la convención del lector: puerta arriba, bisagra a -x (izquierda vista desde adentro), cerrada 0°, abre hacia adentro = horario', () => {
    const p = puertaConfirmada({ x: 2.5, y: 0, ancho: 0.9 }, { ancho: 5, largo: 5 }, { bisagra: 'izquierda', abre: 'adentro' });
    expect([p.bisagraX, p.bisagraY]).toEqual([2.05, 0]);
    expect(p.anguloCerradaDeg).toBe(0);
    expect(p.sentido).toBe('horario');           // 0° → 90° (+y = adentro)
  });

  it('acceso doble: dos hojas de 0.90 con bisagras en los extremos y el mismo lado de apertura', () => {
    const hojas = puertaDobleConfirmada(D08, RECEPCION, { abre: 'adentro' });
    expect(hojas).toHaveLength(2);
    expect(hojas.map((h) => h.ancho)).toEqual([0.9, 0.9]);
    expect(hojas.map((h) => h.bisagraX).sort()).toEqual([2.5, 4.3]);
    expect(hojas.every((h) => h.tieneBarrido && h.doble && h.barridoDeg === 90)).toBe(true);
    expect(hojas.map((h) => h.x).sort()).toEqual([2.95, 3.85]);
  });

  it('confirmarPuertaEnArea sustituye la puerta y la saca de pendientes', () => {
    const area = { ...RECEPCION, puertas: [{ x: 3, y: 0, ancho: 0.9, tieneBarrido: true, bisagraX: 2.55, bisagraY: 0 }, D08], puertasPendientes: [{ x: 3.4, y: 7, ancho: 1.8, motivo: 'BARRIDO_PUERTA_NO_VERIFICADO' }] };
    expect(puertasSinConfirmar([area])).toEqual([{ areaIdx: 0, idx: 1, puerta: D08, areaNombre: 'RECEPCIÓN' }]);
    const out = confirmarPuertaEnArea(area, 1, { doble: true, abre: 'adentro' });
    expect(out.puertas).toHaveLength(3);
    expect(out.puertasPendientes).toBeUndefined();
    expect(puertasSinConfirmar([out])).toEqual([]);
    expect(area.puertas).toHaveLength(2);        // no muta la entrada
  });
});
