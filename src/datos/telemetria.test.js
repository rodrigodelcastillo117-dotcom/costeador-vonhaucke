// Telemetría: captura en anillo, export y robustez (nunca lanza).
import { describe, it, expect, beforeEach } from 'vitest';
import { registrarError, registrarEvento, erroresRecientes, exportarTelemetria, _reset } from './telemetria.js';

describe('telemetría', () => {
  beforeEach(() => _reset());

  it('captura errores con contexto, más recientes primero', () => {
    registrarError(new Error('boom'), { pantalla: 'cotizacion' });
    registrarError('texto', { pantalla: 'cocrear' });
    const r = erroresRecientes();
    expect(r).toHaveLength(2);
    expect(r[0].msg).toBe('texto');          // el más reciente primero
    expect(r[1].ctx.pantalla).toBe('cotizacion');
    expect(r[1].tipo).toBe('error');
  });

  it('captura eventos de uso', () => {
    registrarEvento('abrir_cocrear', { rol: 'direccion' });
    expect(erroresRecientes()[0]).toMatchObject({ tipo: 'evento', msg: 'abrir_cocrear' });
  });

  it('nunca lanza ante entradas raras', () => {
    expect(() => registrarError(null)).not.toThrow();
    expect(() => registrarError(undefined)).not.toThrow();
    expect(() => registrarError({ message: 'x', stack: 'y' })).not.toThrow();
  });

  it('el anillo se limita a 50 entradas', () => {
    for (let i = 0; i < 70; i++) registrarEvento('e' + i);
    expect(erroresRecientes().length).toBe(50);
  });

  it('exporta texto plano legible', () => {
    registrarError(new Error('falló X'), { pantalla: 'acomodo' });
    const txt = exportarTelemetria();
    expect(txt).toMatch(/ERROR/);
    expect(txt).toMatch(/falló X/);
    expect(txt).toMatch(/acomodo/);
  });
});
