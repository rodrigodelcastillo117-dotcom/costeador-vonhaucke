import {describe,it,expect} from 'vitest';
import {dimensionesEnNombre,expandirPiezas} from './espacio.js';

describe('medidas explícitas de partidas para acomodo',()=>{
  it('usa 2420×830 del módulo de recepción en vez de huella genérica',()=>{
    const p=expandirPiezas([{id:'r',nombre:'Módulo recepción 2 usuarios (2420 × 830 mm)',cantidad:1}])[0];
    expect(p.w).toBe(2420);
    expect(p.d).toBe(830);
  });
  it('en guarda de 900×750×420 usa 420 como fondo y 750 como altura',()=>{
    expect(dimensionesEnNombre('Archivero Modulor (900 × 750 × 420 mm)','guarda')).toEqual({w:900,d:420,alto:750});
    const p=expandirPiezas([{id:'a',nombre:'Archivero Modulor 2 puertas (900 × 750 × 420 mm)',cantidad:1}])[0];
    expect(p.w).toBe(900);
    expect(p.d).toBe(420);
  });
  it('mesa 1200×1200 conserva su huella real',()=>{
    const p=expandirPiezas([{id:'m',nombre:'Mesa de juntas (1200 × 1200 mm)',cantidad:1}])[0];
    expect(p.w).toBe(1200);
    expect(p.d).toBe(1200);
  });
});
