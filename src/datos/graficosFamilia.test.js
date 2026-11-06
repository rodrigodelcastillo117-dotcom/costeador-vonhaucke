// Familia GRÁFICOS (E2E plano P-01, 2026-11-06). El insumo real "Impresión en estireno con arte"
// no caía en ninguna familia → "Gráfico/impresión/rótulo" no auto-costeaba y "vinil" lo mandaba a
// tapicería (AMBIGUOUS). Candado: la familia existe, auto-costea contra el insumo de gráficos, y NO
// roba serigrafía (acabado en cristal) ni la tapicería real (vinil/tela de asiento).
import { describe, it, expect } from 'vitest';
import { familiaDeMaterial, aplicarPoliticaMaterial } from './materialMatch.js';

const INS = {
  'impresion-estireno-ch': { id: 'impresion-estireno-ch', nombre: 'Impresion en estireno cal 20 con arte (chica)', seccion: 'graficos', unidad: 'pza', precio: 172, formato: null },
};
const resolver = (id) => INS[id];
const catalogo = Object.values(INS);
const clase = (p) => aplicarPoliticaMaterial(p, resolver, catalogo);

describe('familia GRÁFICOS', () => {
  it('reconoce impresión / estireno / rótulo / gráfico (con y sin acento)', () => {
    expect(familiaDeMaterial('Gráfico textos')).toBe('graficos');
    expect(familiaDeMaterial('grafico de textos')).toBe('graficos');
    expect(familiaDeMaterial('impresión en estireno de textos')).toBe('graficos');
    expect(familiaDeMaterial('impresion en vinil/estireno de textos')).toBe('graficos'); // "impresión" gana a "vinil"
    expect(familiaDeMaterial('rótulo impreso')).toBe('graficos');
  });

  it('el insumo real de gráficos resuelve a la familia graficos', () => {
    expect(familiaDeMaterial('Impresion en estireno cal 20 con arte (chica)')).toBe('graficos');
  });

  it('el despiece de gráfico auto-costea contra el insumo de gráficos', () => {
    const c = clase({ insumoId: 'impresion-estireno-ch', material_solicitado: 'Gráfico textos', nombre: 'Vinil textos copete' });
    expect(c.insumoId).toBe('impresion-estireno-ch');
    expect(c._match.autocosteable).toBe(true);
  });

  it('NO roba serigrafía (acabado en cristal) ni la tapicería real', () => {
    expect(familiaDeMaterial('Serigrafia (cristal)')).toBe('cristal');
    expect(familiaDeMaterial('Vinil tapiz asiento')).toBe('tapiceria');
    expect(familiaDeMaterial('Tela para respaldo')).toBe('tapiceria');
    expect(familiaDeMaterial('Piel sintética')).toBe('tapiceria');
  });
});
