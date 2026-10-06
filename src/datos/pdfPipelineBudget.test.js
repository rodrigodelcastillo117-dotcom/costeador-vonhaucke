import { describe,it,expect } from 'vitest';
import { paginasParaAnalisis } from './pdfPipeline.js';

describe('PDF multi-vista · performance budget',()=>{
  it('conserva todas las páginas si el PDF es pequeño',()=>{
    expect(paginasParaAnalisis(2,4,8)).toEqual([1,2,3,4]);
  });
  it('limita un PDF enorme a 8 páginas cercanas a la elegida',()=>{
    const p=paginasParaAnalisis(25,50,8);
    expect(p).toHaveLength(8);
    expect(p).toContain(25);
    expect(Math.max(...p)-Math.min(...p)).toBe(7);
  });
  it('respeta extremos sin salirse del documento',()=>{
    expect(paginasParaAnalisis(1,50,8)).toEqual([1,2,3,4,5,6,7,8]);
    expect(paginasParaAnalisis(50,50,8)).toEqual([43,44,45,46,47,48,49,50]);
  });
});
