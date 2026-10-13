import { describe, it, expect } from 'vitest';
import { conservarMaterialesConfirmados } from './conservarConfirmados.js';

describe('conservarMaterialesConfirmados (VH-150)', () => {
  const prev = [
    { nombre: 'Respaldo MDF 9 mm', insumoId: 'erp-mdf8', material_confirmado: true, largoMM: 1800, anchoMM: 650 },
    { nombre: 'Laterales', insumoId: 'mdf', material_match: 'SAME_FAMILY_COMPATIBLE_PROPOSED' },   // propuesto por regla, NO humano
  ];
  it('la pieza re-propuesta por la IA sin material recupera el insumo elegido a mano, con su marca de confirmación', () => {
    const nuevos = [{ nombre: 'Respaldo MDF 9 mm', insumoId: '', material_match: 'NOT_AVAILABLE', largoMM: 1800, anchoMM: 700 }, { nombre: 'Laterales', insumoId: '' }];
    const r = conservarMaterialesConfirmados(prev, nuevos);
    expect(r[0]).toMatchObject({ insumoId: 'erp-mdf8', material_confirmado: true, material_match: 'USER_CONFIRMED', anchoMM: 700 });
    expect(r[0]._match.confirmado_por_usuario).toBe(true);
    expect(r[1].insumoId).toBe('');   // lo propuesto por regla no se arrastra: lo decide el flujo normal
  });
  it('si la pieza nueva ya trae confirmación humana propia, gana la nueva; nombres distintos no se mezclan; sin previos devuelve lo nuevo', () => {
    const nuevos = [{ nombre: 'Respaldo MDF 9 mm', insumoId: 'erp-otro', material_confirmado: true }, { nombre: 'Puerta', insumoId: '' }];
    const r = conservarMaterialesConfirmados(prev, nuevos);
    expect(r[0].insumoId).toBe('erp-otro');
    expect(r[1].insumoId).toBe('');
    expect(conservarMaterialesConfirmados([], nuevos)).toBe(nuevos);
  });
});
