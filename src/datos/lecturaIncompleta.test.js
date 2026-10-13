import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { evaluarLectura, elegirLectura, textoDegenerado } from './lecturaIncompleta.js';

// Respuesta REAL de analizar-mueble-rc del lab Costear 2026-10-13 (gabinete alto, VH-178).
const evid = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../lab/noche/dif/costear/gabinete_alto/edges.json'), 'utf8'));
const crudo = evid.find((x) => String(x.fn).startsWith('analizar'));
const gabinete = (typeof crudo.body === 'string' ? JSON.parse(crudo.body) : crudo.body).propuesta;

describe('VH-178 · lectura incompleta de la IA', () => {
  it('la respuesta real del gabinete alto (1 pieza, texto en bucle, informe pendiente) se detecta', () => {
    const e = evaluarLectura(gabinete);
    expect(e.incompleta).toBe(true);
    expect(e.motivos.join(' ')).toMatch(/se trabó/);
    expect(e.motivos.join(' ')).toMatch(/sin terminar/);
    expect(e.motivos.join(' ')).toMatch(/guardado no se arma/);
  });
  it('texto en bucle o secuencia numérica = degenerado; una nota normal no', () => {
    expect(textoDegenerado('Entrepaños 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30 31 32 33 34 35 36 37 38 39 40')).toBe(true);
    expect(textoDegenerado('4 pzas.Entrepaños ajustables ajustables '.repeat(12))).toBe(true);
    expect(textoDegenerado('2000x450 mm; 2 piezas = 1.8 m2 de 2.98 m2 por hoja → 0.6 hoja. Laterales del cuerpo, cantos visibles al frente con tapacanto PVC 2 mm del mismo color, perforación para entrepaños ajustables cada 32 mm.')).toBe(false);
  });
  it('mueble con puertas sin ninguna puerta en el despiece → incompleta; con puertas → ok', () => {
    const base = { producto: 'Credenza 1800 con 3 puertas', piezas: [{ nombre: 'Laterales', cantidad: 2 }, { nombre: 'Cubierta', cantidad: 1 }, { nombre: 'Piso', cantidad: 1 }, { nombre: 'Respaldo', cantidad: 1 }] };
    expect(evaluarLectura(base).motivos.join(' ')).toMatch(/3 puerta/);
    expect(evaluarLectura({ ...base, piezas: [...base.piezas, { nombre: 'Puertas abatibles', cantidad: 3 }] }).incompleta).toBe(false);
  });
  it('lo que el usuario escribió también cuenta ("dos cajones")', () => {
    const p = { producto: 'Escritorio', piezas: [{ nombre: 'Cubierta' }, { nombre: 'Paneles laterales', cantidad: 2 }] };
    expect(evaluarLectura(p, { texto: 'escritorio con dos cajones' }).motivos.join(' ')).toMatch(/2 cajón/);
  });
  it('una lectura buena no se marca (mesa simple, 2 piezas)', () => {
    expect(evaluarLectura({ producto: 'Mesa de centro', piezas: [{ nombre: 'Cubierta' }, { nombre: 'Base tubular', cantidad: 4 }] }).incompleta).toBe(false);
  });
  it('reintento: si la segunda lectura es coherente, gana; si ambas fallan, la de menos problemas; sin reintento válido, la original', () => {
    const v1 = { ok: true, propuesta: gabinete };
    const v2ok = { ok: true, propuesta: { producto: 'Gabinete alto 2 puertas', piezas: [{ nombre: 'Laterales', cantidad: 2 }, { nombre: 'Techo y piso', cantidad: 2 }, { nombre: 'Puertas', cantidad: 2 }, { nombre: 'Respaldo', cantidad: 1 }] } };
    expect(elegirLectura(v1, v2ok)).toMatchObject({ res: v2ok, reintento: true, evaluacion: { incompleta: false } });
    const v2mal = { ok: true, propuesta: { producto: 'Gabinete alto 2 puertas', piezas: [{ nombre: 'Laterales', cantidad: 2 }, { nombre: 'Techo', cantidad: 1 }] } };
    const r = elegirLectura(v1, v2mal);
    expect(r.evaluacion.incompleta).toBe(true);
    expect(r.res).toBe(v2mal);   // 2 problemas contra 4
    expect(elegirLectura(v1, { ok: false })).toMatchObject({ res: v1, reintento: false });
  });
});
