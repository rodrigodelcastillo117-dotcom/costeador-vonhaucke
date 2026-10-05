import { describe, it, expect } from 'vitest';
import { acomodarLocal } from './planner.js';

const area = (nombre, ancho, largo, tipo) => ({ nombre, ancho, largo, ...(tipo ? { tipo } : {}) });
const p = (id, nombre, tipo, w, d, ruta = '') => ({ id, nombre, tipo, w, d, ruta });

describe('acomodo CEO: cada cosa en su tipo de espacio', () => {
  const areas = [
    area('PRIVADO 1', 4500, 3500, 'privado'),
    area('PRIVADO 2', 4500, 3500, 'privado'),
    area('PRIVADO 3', 4500, 3500, 'privado'),
    area('PRIVADO 4', 4500, 3500, 'privado'),
    area('APARTADO 1 (8 PAX)', 8000, 4500, 'open'),
    area('APARTADO 2 (8 PAX)', 8000, 4500, 'open'),
    area('APARTADO 3 (8 PAX)', 8000, 4500, 'open'),
    area('SALA JUNTAS 1', 8000, 5000, 'juntas'),
    area('SALA JUNTAS 2', 8000, 5000, 'juntas'),
    area('RECEPCION', 7000, 3500, 'recepcion'),
  ];

  const piezas = [];
  for (let i = 1; i <= 3; i++) piezas.push(p(`bench-${i}`, 'Banca doble APP LT 1.50 · 8 usuarios · ocupa 6.00 × 1.20 m', 'escritorio', 6000, 1200, 'applt vh-dest-opn'));
  for (let i = 1; i <= 4; i++) {
    piezas.push(p(`desk-${i}`, 'Eclipse Escritorio Directivo 2.10 m', 'escritorio', 2100, 800, 'eclipse vh-dest-prv'));
    piezas.push(p(`cred-${i}`, 'Eclipse Credenza baja 2.10 × 0.60 m', 'guarda', 2100, 600, 'eclipse vh-dest-prv'));
    piezas.push(p(`arch-${i}`, 'Modulor · Archivero horizontal 0.90', 'guarda', 900, 450, 'modulor vh-dest-prv'));
    piezas.push(p(`alpha-${i}`, 'Silla directiva ALPHA', 'asiento', 650, 650, 'banco vh-dest-prv'));
  }
  piezas.push(p('appmesa-1', 'Mesa de juntas APP LT 2.40 × 1.20', 'juntas', 2400, 1200, 'applt vh-dest-mtg'));
  piezas.push(p('cirque-1', 'Cirque · Mesa de juntas cuadrada 1.80 m', 'juntas', 1800, 1800, 'cirque vh-dest-mtg'));
  piezas.push(p('cirque-2', 'Cirque · Mesa de juntas cuadrada 1.80 m', 'juntas', 1800, 1800, 'cirque vh-dest-mtg'));
  for (let i = 1; i <= 20; i++) piezas.push(p(`sonata-${i}`, 'Silla · SONATA', 'asiento', 600, 600, 'banco vh-dest-mtg'));
  piezas.push(p('recep-1', 'Cirque · Recepción recta 2.40 m', 'recepcion', 2400, 800, 'cirque vh-dest-rcp'));
  piezas.push(p('recep-seat-1', 'Silla operativa · GAMMA-E', 'asiento', 600, 600, 'banco vh-dest-rcp'));

  const r = acomodarLocal(areas, piezas);
  const byId = Object.fromEntries(piezas.map((x) => [x.id, x]));
  const rolArea = (c) => areas[c.area]?.tipo;

  it('ningún bench cae en privado/juntas/recepción', () => {
    const benches = r.colocacion.filter((c) => c.id.startsWith('bench-'));
    expect(benches.length).toBe(3);
    expect(new Set(benches.map(rolArea))).toEqual(new Set(['open']));
  });

  it('escritorios, credenzas y archiveros de privado se quedan en privados', () => {
    const ids = /^(desk|cred|arch)-/;
    const colocadas = r.colocacion.filter((c) => ids.test(c.id));
    expect(colocadas.length).toBe(12);
    expect(new Set(colocadas.map(rolArea))).toEqual(new Set(['privado']));
  });

  it('los dos módulos Cirque quedan juntos y APP LT en la otra sala', () => {
    const app = r.colocacion.find((c) => c.id === 'appmesa-1');
    const c1 = r.colocacion.find((c) => c.id === 'cirque-1');
    const c2 = r.colocacion.find((c) => c.id === 'cirque-2');
    expect(app && c1 && c2).toBeTruthy();
    expect(c1.area).toBe(c2.area);
    expect(app.area).not.toBe(c1.area);
    expect(areas[app.area].tipo).toBe('juntas');
    expect(areas[c1.area].tipo).toBe('juntas');
  });

  it('SONATA de juntas nunca termina en un APARTADO o privado', () => {
    const s = r.colocacion.filter((c) => c.id.startsWith('sonata-'));
    expect(s.length).toBe(20);
    expect(new Set(s.map(rolArea))).toEqual(new Set(['juntas']));
    const porSala = s.reduce((m, c) => ({ ...m, [c.area]: (m[c.area] || 0) + 1 }), {});
    expect(Object.values(porSala).sort((a, b) => a - b)).toEqual([8, 12]);
  });

  it('el mostrador queda en recepción y una silla que no quepa NO se fuga a otro cuarto', () => {
    const mostrador = r.colocacion.find((x) => x.id === 'recep-1');
    expect(mostrador).toBeTruthy();
    expect(rolArea(mostrador)).toBe('recepcion');
    const silla = r.colocacion.find((x) => x.id === 'recep-seat-1');
    if (silla) expect(rolArea(silla)).toBe('recepcion');
    else expect(r.caben).toBe(false);
  });

  it('ninguna pieza con destino explícito cruza de tipo de cuarto', () => {
    for (const c of r.colocacion) {
      const pieza = byId[c.id];
      if (pieza.ruta.includes('vh-dest-mtg')) expect(rolArea(c)).toBe('juntas');
      if (pieza.ruta.includes('vh-dest-prv')) expect(rolArea(c)).toBe('privado');
      if (pieza.ruta.includes('vh-dest-rcp')) expect(rolArea(c)).toBe('recepcion');
      if (pieza.ruta.includes('vh-dest-opn')) expect(rolArea(c)).toBe('open');
    }
  });
});
