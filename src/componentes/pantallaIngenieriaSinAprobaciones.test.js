// P1 (auditoria 2caa5ee): la Pantalla de Ingenieria NO debe fabricar aprobaciones.
// Los datos de demo (desarrollo CAD fijo, estandares inventados, autorizado:true) viven SOLO
// en el fixture de demo, nunca en el componente de produccion. RED->GREEN: la version anterior
// del componente tenia 'autorizado: true', 'tarifa_mxn_min' y 'desarrollo_mm' hardcodeados.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const prod = readFileSync(new URL('./PantallaIngenieria.jsx', import.meta.url), 'utf8');

describe('PantallaIngenieria · sin aprobaciones ficticias', () => {
  it('el componente de produccion NO contiene aprobaciones ni estandares/desarrollos hardcodeados', () => {
    expect(prod).not.toMatch(/autorizado\s*:/);        // nada marca autorizado desde la UI
    expect(prod).not.toMatch(/tarifa_mxn_min/);        // no fabrica tarifas de MO
    expect(prod).not.toMatch(/tiempo_proceso_min/);    // no fabrica tiempos de MO
    expect(prod).not.toMatch(/desarrollo_mm/);         // no fabrica un desarrollo CAD fijo
  });

  it('las acciones llegan por prop (no hardcodeadas): el componente las recibe de afuera', () => {
    expect(prod).toMatch(/acciones\s*=\s*\[\]/);        // prop acciones, default vacio
    expect(prod).toMatch(/acciones\.map/);             // se renderizan las acciones provistas
  });

  it('el fixture de demo existe y esta separado del componente de produccion', () => {
    const demo = readFileSync(new URL('./pantallaIngenieria.demo.js', import.meta.url), 'utf8');
    expect(demo).toMatch(/accionesDemo/);
    expect(prod).not.toMatch(/pantallaIngenieria\.demo/);   // el componente NO importa la demo
  });
});
