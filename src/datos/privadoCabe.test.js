import { describe, it, expect } from 'vitest';
import { resolverPrivado } from './resolverPrograma.js';
import { proponerProgramaDelPlano } from './programaRealDelPlano.js';

// E2E 2026-10-20 ("Dibujar mi oficina" · plantilla Corporativo): privados de 3.5 × 4 m recibían el
// módulo directivo 1.80 × 2.40 (3.6 m con la silla) y el acomodo lo rechazaba: "no cabe".
describe('privado · el programa escoge un escritorio que quepa', () => {
  const id = (r) => r.bancoId || r.producto?.id || r.id;
  it('3.5 × 4 m ⇒ gerencial 1.80 × 1.80 (cabe con su silla)', () => {
    expect(id(resolverPrivado({ zona_dims: { anchoM: 3.5, largoM: 4 } }))).toBe('ger-1800x1800');
  });
  it('5 × 5 m ⇒ el módulo directivo de siempre', () => {
    expect(id(resolverPrivado({ zona_dims: { anchoM: 5, largoM: 5 } }))).toBe('dir-1800x2400');
  });
  it('sin medidas ⇒ el de siempre (no se inventa)', () => {
    expect(id(resolverPrivado({}))).toBe('dir-1800x2400');
  });
  it('del plano: las medidas del privado llegan al programa', () => {
    const areas = [
      { nombre: 'Open space', ancho: 10, largo: 8, tipo: 'open' },
      { nombre: 'Privado 1', ancho: 3.5, largo: 4, tipo: 'privado' },
    ];
    const prop = proponerProgramaDelPlano(areas);
    const escritorio = (prop.propuesta?.partidas || prop.preview || []).find((p) => p.relation_role === 'ANCHOR_DESK');
    expect(escritorio && (escritorio.bancoId || escritorio.piezaId)).toBe('ger-1800x1800');
  });
});
