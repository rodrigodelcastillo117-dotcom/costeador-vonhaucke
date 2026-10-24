import { describe, it, expect } from 'vitest';
import { insumosCompartibles } from './insumosCompartibles.js';

describe('insumosCompartibles · la config compartida no recibe artículos del ERP', () => {
  it('quita los ERP elegidos en el buscador y deja la foto curada intacta', () => {
    const local = {
      mdf: { id: 'mdf', clasificacion: 'vigente', precio: 300 },
      'mdf-25': { id: 'mdf-25', clasificacion: 'nuevo', precio: 500 },
      'erp-silestone321512-y19': { id: 'erp-silestone321512-y19', clasificacion: 'erp', precio: 24283.09 },
    };
    expect(Object.keys(insumosCompartibles(local)).sort()).toEqual(['mdf', 'mdf-25']);
    expect(insumosCompartibles(local).mdf).toBe(local.mdf);
  });
  it('agregar un ERP local NO cambia lo que se compararía para escribir (no dispara escritura)', () => {
    const base = { mdf: { id: 'mdf', clasificacion: 'vigente' } };
    const conErp = { ...base, 'erp-x': { id: 'erp-x', clasificacion: 'erp' } };
    expect(JSON.stringify(insumosCompartibles(conErp))).toBe(JSON.stringify(insumosCompartibles(base)));
  });
});
