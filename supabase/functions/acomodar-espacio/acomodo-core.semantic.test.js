import { describe, it, expect } from 'vitest';
import { planearDeterminista } from './acomodo-core.js';

describe('acomodo semántico', () => {
  const areas = [
    { nombre: 'Área operativa', ancho: 5000, largo: 5000 },
    { nombre: 'Sala de juntas', ancho: 5000, largo: 5000 },
  ];

  it('respeta allowedAreas aunque otra zona tenga espacio', () => {
    const piezas = [{ id:'chair-meeting-1', nombre:'Silla de juntas', w:600, d:600, allowedAreas:[1] }];
    const r = planearDeterminista(areas, piezas, { gapMM:150, stepMM:100 });
    expect(r.colocacion).toHaveLength(1);
    expect(r.colocacion[0].area).toBe(1);
  });

  it('fail-closed: no invade otra zona cuando la permitida está llena', () => {
    const piezas = [
      { id:'mesa', nombre:'Mesa juntas', w:4800, d:4800, allowedAreas:[1] },
      { id:'chair-meeting-1', nombre:'Silla juntas', w:900, d:900, allowedAreas:[1] },
    ];
    const r = planearDeterminista(areas, piezas, { gapMM:150, stepMM:100 });
    expect(r.colocacion.some(x => x.id==='chair-meeting-1' && x.area===0)).toBe(false);
  });
});
