// Regresión (plano TELCEL real): el KIT de iluminación ya incluye su fuente (Mean Well),
// así que 'led_sin_driver' NO debe dispararse ni bloquear la certificación. Una tira LED
// suelta SIN fuente sí debe seguir bloqueando.
import { describe, it, expect } from 'vitest';
import { detectarOmisiones } from './deteccionOmisiones.js';

const ledDriver = (r) => r.hallazgos.find((h) => h.regla === 'led_sin_driver');

describe('led_sin_driver · un kit que empaca su fuente NO es falso positivo', () => {
  it('KIT con fuente Mean Well (como el TELCEL) → NO dispara ni bloquea', () => {
    const r = detectarOmisiones({ piezas: [
      { nombre: 'TELSVH120-KIT Kit iluminación LED', material_solicitado: 'kit LED 5 tiras 1 m 5050 4000K, fuente de voltaje 100W Mean Well, cable', semantic_role: 'otro' },
    ] });
    expect(ledDriver(r)).toBeFalsy();
    expect(r.resumen.bloquea_certificacion).toBe(false);
  });

  it('nombre del insumo "(tiras + fuente + arnes)" también cuenta como alimentación', () => {
    const insumos = { 'kit-led-5000k': { nombre: 'Kit iluminacion LED 5000 K (tiras + fuente + arnes)' } };
    const r = detectarOmisiones({ piezas: [
      { nombre: 'Kit iluminación LED', insumoId: 'kit-led-5000k', semantic_role: 'otro' },
    ], insumos });
    expect(ledDriver(r)).toBeFalsy();
  });

  it('una tira LED SOLA sin fuente/driver → SÍ dispara y bloquea (no se relajó la regla)', () => {
    const r = detectarOmisiones({ piezas: [
      { nombre: 'Tira LED 5 m 5050', material_solicitado: 'tira de led', semantic_role: 'otro' },
    ] });
    const h = ledDriver(r);
    expect(h).toBeTruthy();
    expect(h.bloquea_certificacion).toBe(true);
  });
});
