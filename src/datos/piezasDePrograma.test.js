import { describe, expect, it } from 'vitest';
import { normalizarAreasPrograma, partidasSugeridasDeAreas, paxDeNombre } from './piezasDePrograma.js';

describe('programa sugerido desde plano', () => {
  it('lee PAX del nombre', () => {
    expect(paxDeNombre('OPERATIVO 1 (8 PAX)')).toBe(8);
    expect(paxDeNombre('Bench 6 usuarios')).toBe(6);
  });

  it('relaciona Isla OPERATIVO con su cuarto y hereda PAX', () => {
    const areas = normalizarAreasPrograma([
      { nombre: 'OPERATIVO 1 (8 PAX)', ancho: 7.5, largo: 4 },
      { nombre: 'Isla OPERATIVO 1', ancho: 6, largo: 2.2 },
    ]);
    const padre = areas.find((a) => a.nombre.startsWith('OPERATIVO'));
    const isla = areas.find((a) => a.nombre.startsWith('Isla'));
    expect(isla.dentroDe).toBe(padre.nombre);
    expect(isla.puestos).toBe(8);
    expect(padre.contiene).toBeGreaterThan(0);
  });

  it('8 PAX genera 1 bench APP LT + 8 sillas + 8 gavetas sin duplicar padre', () => {
    const p = partidasSugeridasDeAreas([
      { nombre: 'OPERATIVO 1 (8 PAX)', ancho: 7.5, largo: 4 },
      { nombre: 'Isla OPERATIVO 1', ancho: 6.5, largo: 2.2 },
    ]);
    const bench = p.filter((x) => /Banca doble APP LT/.test(x.nombre));
    const sillas = p.filter((x) => /Silla operativa · WIN/.test(x.nombre));
    const gavetas = p.filter((x) => /Gaveta rodante APP LT/.test(x.nombre));
    expect(bench).toHaveLength(1);
    expect(bench[0].nombre).toContain('8 usuarios');
    expect(sillas[0].cantidad).toBe(8);
    expect(gavetas[0].cantidad).toBe(8);
  });

  it('sala de juntas genera mesa y sillas según capacidad', () => {
    const p = partidasSugeridasDeAreas([
      { nombre: 'SALA JUNTAS 1 (8 PAX)', tipo: 'juntas', ancho: 8, largo: 3.5 },
    ]);
    expect(p.some((x) => /Mesa de juntas 8 personas/.test(x.nombre))).toBe(true);
    const s = p.find((x) => /Silla de juntas/.test(x.nombre));
    expect(s.cantidad).toBe(8);
  });

  it('recepción se amuebla y sanitarios/site no', () => {
    const p = partidasSugeridasDeAreas([
      { nombre: 'RECEPCION', tipo: 'recepcion', ancho: 6, largo: 3 },
      { nombre: 'SANITARIOS H', tipo: 'servicio', ancho: 3, largo: 2 },
      { nombre: 'SITE', tipo: 'servicio', ancho: 3, largo: 2 },
    ]);
    expect(p.some((x) => /Mostrador de recepción/.test(x.nombre))).toBe(true);
    expect(p.some((x) => /SANITARIOS|SITE/.test(x.nombre))).toBe(false);
  });

  it('fail-closed para líneas no habilitadas', () => {
    const p = partidasSugeridasDeAreas([{ nombre: 'OPERATIVO 1 (8 PAX)', ancho: 7.5, largo: 4 }], { linea: 'otra' });
    expect(p).toEqual([]);
  });
});
