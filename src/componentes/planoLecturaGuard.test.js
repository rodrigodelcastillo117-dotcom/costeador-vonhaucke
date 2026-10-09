import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

// ChatGPT P0-A: una lectura de plano lenta (hasta 180 s) NO puede pisar una
// subida más nueva cuando por fin resuelve (respuesta vieja ≠ archivo nuevo).
describe('Voni · subirPlanoAqui tiene stale-guard por id de subida (P0-A)', () => {
  const s = fs.readFileSync('src/componentes/Voni.jsx', 'utf8');

  it('cada subida toma un id creciente y descarta resultados superados', () => {
    expect(s).toContain('const reqPlanoRef = useRef(0)');
    expect(s).toContain('const miReq = ++reqPlanoRef.current');
    // tras resolver (y tras error), si hay una subida más nueva, se descarta.
    const n = (s.match(/if \(miReq !== reqPlanoRef\.current\) return;/g) || []).length;
    expect(n).toBeGreaterThanOrEqual(2);   // en el camino OK y en el catch
  });

  it('error recuperable: el catch avisa y no deja la UI colgada en "leyendo"', () => {
    expect(s).toContain('setLeyendoPlano(false)');
    expect(s).toContain('No se pudo leer el plano');
  });
});
