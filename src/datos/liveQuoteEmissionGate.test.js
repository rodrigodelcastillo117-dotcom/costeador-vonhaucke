import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

describe('emisión · nunca gatea una cotización vieja si falla el guardado vivo', () => {
  it('guardarCotizacion reporta null ante excepción', () => {
    const s = fs.readFileSync('src/datos/cotizaciones.js', 'utf8');
    const i = s.indexOf('export async function guardarCotizacion');
    const b = s.slice(i, s.indexOf('/**', i + 20));
    expect(b).toContain('catch (e)');
    expect(b).toContain("guardado: false, motivo: 'red'");   // nunca se reporta guardado lo que no llegó
    expect(b).not.toContain('catch (e) {\n    return id;');
  });

  it('verificarEmision falla cerrado antes de cotizacionEmitible si no guardó', () => {
    const s = fs.readFileSync('src/App.jsx', 'utf8');
    const i = s.indexOf('async function verificarEmision');
    const j = s.indexOf('async function onEmitida', i);
    const b = s.slice(i, j);
    expect(b).toContain('await guardarEnNube()');
    expect(b).toContain('!r.guardado');
    expect(b).toContain("estado: 'DESCONOCIDO'");
    expect(b).toContain('evaluarEmision(r.id');   // VH-055: el MISMO snapshot que se emitirá
  });

  it('onEmitida no congela revisión contra un id anterior', () => {
    const s = fs.readFileSync('src/App.jsx', 'utf8');
    const i = s.indexOf('async function onEmitida');
    const j = s.indexOf('// permiso ===', i);
    const b = s.slice(i, j);
    expect(b).toContain('await guardarEnNube()');
    expect(b).toContain('!g.guardado');
    expect(b).toContain("'no-se-guardo-estado-vivo'");
    expect(b).toContain('guardarRevision(estado, g.id)');
  });
});
