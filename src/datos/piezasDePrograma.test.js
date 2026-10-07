import { describe, expect, it } from 'vitest';
import { normalizarAreasPrograma, partidasSugeridasDeAreas, paxDeNombre } from './piezasDePrograma.js';
import { expandirPiezas } from './espacio.js';

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

  it('MUTACIÓN #102: 10 puestos → bench con geometría REAL 6000, NUNCA 7500', () => {
    const p = partidasSugeridasDeAreas([{ nombre: 'OPERATIVO 1 (10 PAX)', ancho: 9, largo: 3.2 }]);
    const bench = p.find((x) => /Banca doble APP LT/.test(x.nombre));
    expect(bench).toBeTruthy();
    expect(bench.usuarios).toBe(10);
    expect(bench.w).toBe(6000);           // módulo real op-10u
    expect(bench.w).not.toBe(7500);       // la geometría fantasma no vuelve
    expect(bench.d).toBe(1200);
  });

  it('APARTADO con PAX es operativo y nunca privado/general', () => {
    const a = normalizarAreasPrograma([
      { nombre: 'APARTADO 1 (6 PAX)', ancho: 6.75, largo: 3.5 },
      { nombre: 'APARTADO 2 (6 PAX)', ancho: 6.75, largo: 3.5 },
      { nombre: 'APARTADO 3 (8 PAX)', ancho: 13.5, largo: 3 },
    ]);
    expect(a.map((x) => x.tipo)).toEqual(['open', 'open', 'open']);
    expect(a.map((x) => x.puestos)).toEqual([6, 6, 8]);
  });

  it('golden CEO APARTADO 6/6/8 produce sólo benches operativos 6/6/8', () => {
    const p = partidasSugeridasDeAreas([
      { nombre: 'APARTADO 1 (6 PAX)', ancho: 6.75, largo: 3.5 },
      { nombre: 'APARTADO 2 (6 PAX)', ancho: 6.75, largo: 3.5 },
      { nombre: 'APARTADO 3 (8 PAX)', ancho: 13.5, largo: 3 },
    ]);
    const benches = p.filter((x) => /Banca doble APP LT/.test(x.nombre));
    expect(benches).toHaveLength(3);
    expect(benches.map((x) => x.usuarios)).toEqual([6, 6, 8]);
    expect(p.some((x) => /Escritorio directivo|Silla directiva/.test(x.nombre))).toBe(false);
    expect(p.filter((x) => /Silla operativa · WIN/.test(x.nombre)).reduce((s, x) => s + x.cantidad, 0)).toBe(20);
    expect(p.filter((x) => /Gaveta rodante APP LT/.test(x.nombre)).reduce((s, x) => s + x.cantidad, 0)).toBe(20);
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


describe('grupos funcionales desde el programa', () => {
  it('bench + sillas + gavetas nacen con el mismo functional_group_id', () => {
    const p = partidasSugeridasDeAreas([{ nombre:'OPERATIVO 1 (4 PAX)', ancho:6, largo:3.5 }]);
    const bench = p.find((x) => /Banca doble/.test(x.nombre));
    const chairs = p.find((x) => /Silla operativa/.test(x.nombre));
    const drawers = p.find((x) => /Gaveta rodante/.test(x.nombre));
    expect(bench.functional_group_id).toBeTruthy();
    expect(chairs.functional_group_id).toBe(bench.functional_group_id);
    expect(drawers.functional_group_id).toBe(bench.functional_group_id);
    expect(bench.relation_role).toBe('ANCHOR_WORKSTATION');
    expect(chairs.anchor_role).toBe('ANCHOR_WORKSTATION');
  });

  it('expandirPiezas conserva grupo/rol/ancla en cada silla física', () => {
    const p = partidasSugeridasDeAreas([{ nombre:'SALA JUNTAS 1 (4 PAX)', tipo:'juntas', ancho:6, largo:4 }]);
    const piezas = expandirPiezas(p);
    const mesa = piezas.find((x) => /Mesa de juntas/.test(x.nombre));
    const sillas = piezas.filter((x) => /Silla de juntas/.test(x.nombre));
    expect(mesa.functional_group_id).toBeTruthy();
    expect(sillas).toHaveLength(4);
    expect(sillas.every((x) => x.functional_group_id === mesa.functional_group_id)).toBe(true);
    expect(sillas.every((x) => x.anchor_role === 'ANCHOR_MEETING')).toBe(true);
  });
});
