import { describe, it, expect } from 'vitest';
import { resolverArticuloCatalogo } from './resolverArticulo.js';

const norm = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
const primerToken = (d) => norm(d).trim().split(/\s+/)[0];

describe('resolverArticuloCatalogo — casa item de Voni con el catálogo real', () => {
  it('escritorio 2400/D/chapa: varios candidatos, el base es el más barato que cumple', () => {
    const r = resolverArticuloCatalogo({ ruta: 'eclipse', producto: 'escritorio', config: { largoMM: 2400, mano: 'D', finish: 'chapa' } });
    expect(r.estado).toBe('varios');
    // El base concreto verificado a mano contra el Excel: escritorio-credenza 2400 D chapa.
    expect(r.articulo.clave).toBe('ECCR82DCH');
    expect(r.articulo.lista).toBe(27220);
    // Ordenados por precio ascendente: el base es el mínimo.
    const precios = r.candidatos.map((a) => a.lista);
    expect(precios[0]).toBe(Math.min(...precios));
  });

  it('escritorio NO se lleva las variantes cantilever ni qvadrat (son otro producto de Voni)', () => {
    const r = resolverArticuloCatalogo({ ruta: 'eclipse', producto: 'escritorio', config: { largoMM: 2400, mano: 'D', finish: 'chapa' } });
    for (const a of r.candidatos) {
      expect(norm(a.descripcion)).not.toMatch(/CANTILEVER|QVADRAT/);
    }
  });

  it('cantilever: todos los candidatos son cantilever', () => {
    const r = resolverArticuloCatalogo({ ruta: 'eclipse', producto: 'cantilever', config: { largoMM: 2400, mano: 'I' } });
    expect(r.estado).not.toBe('ninguno');
    for (const a of r.candidatos) expect(norm(a.descripcion)).toMatch(/CANTILEVER/);
  });

  it('credenza (baja) NO se confunde con "ESCRITORIO CREDENZA": primer token CREDENZA', () => {
    const r = resolverArticuloCatalogo({ ruta: 'eclipse', producto: 'credenza', config: { largoMM: 2400, mano: 'D', finish: 'chapa' } });
    expect(r.estado).not.toBe('ninguno');
    for (const a of r.candidatos) expect(primerToken(a.descripcion)).toBe('CREDENZA');
  });

  it('la mano manda: pedir I devuelve el izquierdo verificado y no revuelve derechos', () => {
    const r = resolverArticuloCatalogo({ ruta: 'eclipse', producto: 'escritorio', config: { largoMM: 2400, mano: 'I', finish: 'chapa' } });
    // Existe el izquierdo verificado a mano.
    expect(r.candidatos.some((a) => a.clave === 'ECCR82ICH')).toBe(true);
    // Y no aparece el derecho equivalente.
    expect(r.candidatos.every((a) => a.clave !== 'ECCR82DCH')).toBe(true);
  });

  it('la medida manda: 2100 no cae en el pool de 2400', () => {
    const r24 = resolverArticuloCatalogo({ ruta: 'eclipse', producto: 'escritorio', config: { largoMM: 2400, mano: 'D', finish: 'chapa' } });
    const r21 = resolverArticuloCatalogo({ ruta: 'eclipse', producto: 'escritorio', config: { largoMM: 2100, mano: 'D', finish: 'chapa' } });
    const claves24 = new Set(r24.candidatos.map((a) => a.clave));
    expect(r21.candidatos.every((a) => a.clave !== 'ECCR82DCH')).toBe(true);
    expect(claves24.has('ECCR82DCH')).toBe(true);
  });

  it('mesa de juntas y mesa de consejo se distinguen por el sub-tipo', () => {
    const juntas = resolverArticuloCatalogo({ ruta: 'eclipse', producto: 'mesa_juntas', config: { largoMM: 1200 } });
    const consejo = resolverArticuloCatalogo({ ruta: 'eclipse', producto: 'mesa_consejo', config: { largoMM: 1800 } });
    for (const a of juntas.candidatos || []) expect(norm(a.descripcion)).toMatch(/JUNTA/);
    for (const a of consejo.candidatos || []) expect(norm(a.descripcion)).toMatch(/CONSEJO/);
  });

  it('archivero: varios, todos primer token ARCHIVERO', () => {
    const r = resolverArticuloCatalogo({ ruta: 'via', producto: 'archivero', config: {} });
    expect(r.estado).not.toBe('ninguno');
    for (const a of r.candidatos) expect(primerToken(a.descripcion)).toBe('ARCHIVERO');
  });

  it('benching (bench_recto_doble) NO se casa como artículo único: cae a ninguno', () => {
    const r = resolverArticuloCatalogo({ ruta: 'applt', producto: 'bench_recto_doble', config: { largoMM: 1500 } });
    expect(r.estado).toBe('ninguno');
  });

  it('producto no mapeado o item incompleto → ninguno, sin reventar', () => {
    expect(resolverArticuloCatalogo({ ruta: 'eclipse', producto: 'perchero', config: {} }).estado).toBe('ninguno');
    expect(resolverArticuloCatalogo({}).estado).toBe('ninguno');
    expect(resolverArticuloCatalogo(null).estado).toBe('ninguno');
  });

  it('el artículo devuelto trae lista/full/mínimo para poder cotizar y topar el piso', () => {
    const r = resolverArticuloCatalogo({ ruta: 'eclipse', producto: 'credenza', config: { largoMM: 2400, mano: 'D' } });
    const a = r.articulo;
    expect(a.clave).toBeTruthy();
    expect(a.lista).toBeGreaterThan(0);
    expect(a.full).toBeGreaterThanOrEqual(a.lista);
    expect(a.minimo).toBeGreaterThanOrEqual(0);
  });
});
