import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

// ChatGPT P0-1: VONI ya NO tira el observed_program del lector. subirPlanoAqui lo
// persiste en el acomodo y EstoEntendi lo recibe/usa (procedencia conservada hasta
// "Esto entendí"), en vez de re-inferir todo desde áreas.
describe('VONI/EstoEntendi · conservan el observed_program del lector (P0-1)', () => {
  const voni = fs.readFileSync('src/componentes/Voni.jsx', 'utf8');
  const ee = fs.readFileSync('src/componentes/EstoEntendi.jsx', 'utf8');

  it('subirPlanoAqui PERSISTE lectura/floorSpec/request_id/observed_program', () => {
    expect(voni).toContain('lectura: r.lectura');
    expect(voni).toContain('floorSpec: r.floorSpec');
    expect(voni).toContain('request_id: r.request_id');
    expect(voni).toContain('observed_program: Array.isArray(r.observed_program)');
    // ya NO persiste SÓLO la geometría
    expect(voni).not.toContain("onGuardarAcomodo?.({ ...bloqueGeometria(r.areas), plan: null, planReal: true });");
  });

  it('EstoEntendi recibe observedProgram y lo usa', () => {
    expect(voni).toContain('observedProgram={cot.acomodo?.observed_program');
    expect(ee).toContain("import { resumenObservado } from '../datos/observedProgram.js'");
    expect(ee).toContain('observedProgram = []');
    expect(ee).toContain('resumenObservado(observedProgram)');
    expect(ee).toContain('mueble(s) observado(s)');
  });
});
