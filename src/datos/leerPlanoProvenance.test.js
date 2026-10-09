import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

// ChatGPT #5: la lectura del plano debe CONSERVAR su procedencia hasta VONI /
// "Esto entendí". Antes leerPlanoDeArchivo devolvía sólo areas+nota y tiraba
// lectura/floorSpec/page/request_id/observed_program.
describe('leerPlanoDeArchivo · conserva procedencia (ChatGPT #5)', () => {
  const s = fs.readFileSync('src/datos/leerPlanoArchivo.js', 'utf8');

  it('el retorno conserva lectura, floorSpec, request_id y observed_program', () => {
    expect(s).toContain('lectura: lec');
    expect(s).toContain('floorSpec: r.floorSpec');
    expect(s).toContain('request_id: r.request_id');
    expect(s).toContain('observed_program: observedProgram');
  });

  it('deriva el observed_program del LECTOR REAL (cable floorPlanReader)', () => {
    expect(s).toContain("from './floorPlanReader.js'");
    expect(s).toContain('observedProgramDeLectura(programaDelPlano(areas))');
  });

  it('ya NO devuelve sólo areas+nota (procedencia descartada)', () => {
    expect(s).not.toContain("return { ok: true, areas, nota: notas.join(' ') };");
  });
});
