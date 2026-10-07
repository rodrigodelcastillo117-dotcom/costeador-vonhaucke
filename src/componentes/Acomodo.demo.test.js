import { describe, expect, it } from 'vitest';
import { elegirPartidasAcomodo } from './Acomodo.jsx';

describe('Acomodo · fuente única de mobiliario', () => {
  it('si Voni ya creó partidas reales, no suma sugeridos del plano', () => {
    const reales = [
      { id: 'r1', nombre: 'Banca doble APP LT · 8 usuarios', cantidad: 3 },
      { id: 'r2', nombre: 'Silla operativa · WIN', cantidad: 24 },
    ];
    const sugeridas = [
      { id: 'sug-1', sugeridoPlano: true, nombre: 'Banca APP LT · APARTADO 1', cantidad: 1 },
      { id: 'sug-2', sugeridoPlano: true, nombre: 'Silla WIN · APARTADO 1', cantidad: 6 },
    ];
    const elegidas = elegirPartidasAcomodo(reales, sugeridas);
    expect(elegidas.map((p) => p.id)).toEqual(['r1', 'r2']);
    expect(elegidas.some((p) => p.sugeridoPlano || String(p.id).startsWith('sug-'))).toBe(false);
    // El contexto espacial se añade sólo a la copia de Acomodo; no es una pieza extra.
    expect(elegidas[0].ruta).toContain('vh-dest-opn');
    expect(elegidas[1].ruta).toContain('vh-dest-opn');
  });

  it('#6: sin partidas comerciales el SOLVER no recibe nada (jamás sug-*)', () => {
    const sugeridas = [{ id: 'sug-1', sugeridoPlano: true, nombre: 'Preview', cantidad: 1 }];
    // El preview del programa se muestra aparte; el input del solver es reales-only.
    expect(elegirPartidasAcomodo([], sugeridas)).toEqual([]);
    expect(elegirPartidasAcomodo([])).toEqual([]);
  });
});
