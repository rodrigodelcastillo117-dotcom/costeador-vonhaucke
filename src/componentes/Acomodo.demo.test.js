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
    expect(elegirPartidasAcomodo(reales, sugeridas)).toEqual(reales);
  });

  it('sin partidas comerciales sí usa sugeridos como preview visual', () => {
    const sugeridas = [{ id: 'sug-1', sugeridoPlano: true, nombre: 'Preview', cantidad: 1 }];
    expect(elegirPartidasAcomodo([], sugeridas)).toEqual(sugeridas);
  });
});
