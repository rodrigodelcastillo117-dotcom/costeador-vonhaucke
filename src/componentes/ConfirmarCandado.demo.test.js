import { describe, expect, it } from 'vitest';
import { candadoCantidadYaAclarado, problemasCandado } from './ConfirmarCandado.jsx';

describe('ConfirmarCandado · demo CEO', () => {
  it('3 bancas × 8 = 24 ya aclarado no vuelve a pedir confirmación', () => {
    const p = {
      id: 'bench',
      nombre: 'Banca doble APP LT 1.50 · 8 usuarios · ocupa 6.00 × 1.20 m',
      cantidad: 3,
      candadoUsuarios: true,
      nota: 'Según aclaración son 24 lugares: 3 bancas de 8 usuarios.',
    };
    expect(candadoCantidadYaAclarado(p)).toBe(true);
    expect(problemasCandado([p])).toEqual([]);
  });

  it('sin aclaración explícita conserva el candado', () => {
    const p = {
      id: 'bench', nombre: 'Banca doble APP LT · 8 usuarios', cantidad: 3,
      candadoUsuarios: true,
    };
    expect(candadoCantidadYaAclarado(p)).toBe(false);
    expect(problemasCandado([p])).toEqual([p]);
  });

  it('requiereProyectista jamás se auto-confirma', () => {
    const p = {
      id: 'especial', nombre: 'Especial', cantidad: 1,
      candadoUsuarios: true, requiereProyectista: true,
      nota: '1 pieza para 8 usuarios = 8 lugares',
    };
    expect(candadoCantidadYaAclarado(p)).toBe(false);
    expect(problemasCandado([p])).toEqual([p]);
  });
});
