import { describe, expect, it } from 'vitest';
import { inferirDestinoPartida, marcarDestinoPartida } from './destinoAcomodo.js';
import { expandirPiezas, mapaPiezas } from './espacio.js';
import { reacomodar } from './reacomodar.js';
import { elegirPartidasAcomodo, complementosJuntasVisuales } from '../componentes/Acomodo.jsx';

describe('layout · salas de juntas no se pierden ni fugan sillas', () => {
  it('recupera el destino de los modelos del programa guiado cuando la IA perdió la etiqueta', () => {
    expect(inferirDestinoPartida({ nombre: 'Silla · SONATA' })).toBe('juntas');
    expect(inferirDestinoPartida({ nombre: 'Silla · CONCERTO' })).toBe('privado');
    expect(inferirDestinoPartida({ nombre: 'Silla operativa · WIN' })).toBe('open');
    expect(inferirDestinoPartida({ nombre: 'Silla · SONATA', nota: 'para recepción' })).toBe('recepcion');
  });

  it('si la lista comercial omitió la sala, completa SOLO el preview de juntas y nunca lo cobra', () => {
    const reales = [
      { id: 'r1', nombre: 'Banca doble APP LT · 8 usuarios', cantidad: 1 },
      { id: 'r2', nombre: 'Silla operativa · WIN', cantidad: 8 },
    ];
    const sugeridas = [
      { id: 'sug-open', sugeridoPlano: true, noCobrar: true, nombre: 'Banca APP LT · OPERATIVO', cantidad: 1 },
      { id: 'sug-mesa', sugeridoPlano: true, noCobrar: true, nombre: 'Mesa de juntas 8 personas · SALA JUNTAS', cantidad: 1, ruta: 'sugerido-plano' },
      { id: 'sug-sillas', sugeridoPlano: true, noCobrar: true, nombre: 'Silla de juntas · SALA JUNTAS', cantidad: 8, ruta: 'sugerido-plano' },
    ];

    const extras = complementosJuntasVisuales(reales.map(marcarDestinoPartida), sugeridas);
    expect(extras.reduce((s, p) => s + p.cantidad, 0)).toBe(9);
    expect(extras.every((p) => p.sugeridoPlano && p.noCobrar && p.previewFaltante)).toBe(true);
    expect(extras.some((p) => p.id.includes('sug-open'))).toBe(false);
  });

  it('no duplica una sala que ya viene completa en partidas reales', () => {
    const reales = [
      { id: 'm1', nombre: 'Mesa de juntas APP LT', cantidad: 1, nota: 'para sala de juntas' },
      { id: 's1', nombre: 'Silla · SONATA', cantidad: 8, nota: 'para sala de juntas' },
    ];
    const sugeridas = [
      { id: 'sug-mesa', sugeridoPlano: true, noCobrar: true, nombre: 'Mesa de juntas 8 personas · SALA JUNTAS', cantidad: 1 },
      { id: 'sug-sillas', sugeridoPlano: true, noCobrar: true, nombre: 'Silla de juntas · SALA JUNTAS', cantidad: 8 },
    ];
    expect(complementosJuntasVisuales(reales.map(marcarDestinoPartida), sugeridas)).toEqual([]);
  });

  it('una SONATA genérica queda en juntas Y físicamente ligada a una mesa', () => {
    const reales = [
      { id: 'bench', nombre: 'Banca doble APP LT · 4 usuarios', cantidad: 1, w: 3000, d: 1200 },
      { id: 'win', nombre: 'Silla operativa · WIN', cantidad: 4 },
      { id: 'sonata', nombre: 'Silla · SONATA', cantidad: 4 },
      { id: 'mesa', nombre: 'Mesa de juntas 4 personas', cantidad: 1, w: 2200, d: 1200 },
    ];
    const elegidas = elegirPartidasAcomodo(reales, []);
    const piezas = expandirPiezas(elegidas);
    const areas = [
      { nombre: 'OPERATIVO', tipo: 'open', ancho: 7000, largo: 4500 },
      { nombre: 'SALA JUNTAS', tipo: 'juntas', ancho: 6500, largo: 4500 },
    ];
    const r = reacomodar({ areas, piezas, byId: mapaPiezas(piezas), ajustar: false });
    const sonatas = new Set(piezas.filter((p) => /sonata/i.test(p.nombre)).map((p) => p.id));
    const colocadas = r.colocacion.filter((c) => sonatas.has(c.id));
    expect(colocadas.length).toBe(4);
    expect(new Set(colocadas.map((c) => areas[c.area].tipo))).toEqual(new Set(['juntas']));
    expect(colocadas.every((c) => c.alrededorDe && String(c.contra).startsWith('mesa:'))).toBe(true);
    expect(r.auditoria.some((a) => a.check === 'Sillas de juntas junto a su mesa' && a.ok)).toBe(true);
  });
});
